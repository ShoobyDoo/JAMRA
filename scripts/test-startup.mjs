#!/usr/bin/env node

/**
 * Test script to verify the app loads without blocking
 * Tests both initial load and reload scenarios
 */

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

const CATALOG_PORT = 4545;
const NEXT_PORT = 3000;
const CATALOG_URL = `http://localhost:${CATALOG_PORT}`;
const APP_URL = `http://localhost:${NEXT_PORT}`;
const TIMEOUT_MS = 10000; // 10 second timeout for page loads

let catalogProcess = null;
let nextProcess = null;
let browser = null;

async function startCatalogServer() {
  console.log('[TEST] Starting catalog server...');

  catalogProcess = spawn('pnpm', ['run', 'run', 'bootstrap', 'web'], {
    env: {
      ...process.env,
      JAMRA_API_PORT: String(CATALOG_PORT),
      NEXT_PUBLIC_JAMRA_API_URL: `${CATALOG_URL}/api`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  catalogProcess.stdout.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('Catalog server listening')) {
      console.log(`[CATALOG] ${msg.trim()}`);
    } else if (msg.includes('DownloadWorker') || msg.includes('OfflineStorage')) {
      console.log(`[CATALOG] ${msg.trim()}`);
    }
  });

  catalogProcess.stderr.on('data', (data) => {
    console.error(`[CATALOG ERROR] ${data.toString().trim()}`);
  });

  // Wait for catalog server to be ready
  let attempts = 0;
  while (attempts < 30) {
    try {
      const response = await fetch(`${CATALOG_URL}/api/health`).catch(() => null);
      if (response?.ok) {
        console.log('[TEST] ✅ Catalog server is ready');
        return;
      }
    } catch {}
    await setTimeout(500);
    attempts++;
  }
  throw new Error('Catalog server failed to start');
}

async function startNextServer() {
  console.log('[TEST] Starting Next.js server...');

  nextProcess = spawn('pnpm', ['run', 'dev'], {
    env: {
      ...process.env,
      PORT: String(NEXT_PORT),
      NEXT_PUBLIC_JAMRA_API_URL: `${CATALOG_URL}/api`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  nextProcess.stdout.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('Ready') || msg.includes('compiled') || msg.includes('started server')) {
      console.log(`[NEXT] ${msg.trim()}`);
    }
  });

  nextProcess.stderr.on('data', (data) => {
    const msg = data.toString();
    // Next.js logs some things to stderr that aren't errors
    if (!msg.includes('webpack') && !msg.includes('Watchpack')) {
      console.error(`[NEXT ERROR] ${msg.trim()}`);
    }
  });

  // Wait for Next.js server to be ready
  let attempts = 0;
  while (attempts < 60) {
    try {
      const response = await fetch(APP_URL).catch(() => null);
      if (response) {
        console.log('[TEST] ✅ Next.js server is ready');
        return;
      }
    } catch {}
    await setTimeout(1000);
    attempts++;
  }
  throw new Error('Next.js server failed to start');
}

async function testPageLoad(url, testName) {
  console.log(`\n[TEST] Running: ${testName}`);
  const startTime = Date.now();

  const page = await browser.newPage();

  // Collect console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes('ERROR') || text.includes('Failed')) {
      console.log(`  [PAGE CONSOLE] ${text}`);
    }
  });

  // Detect page errors
  page.on('pageerror', error => {
    console.error(`  [PAGE ERROR] ${error.message}`);
  });

  try {
    // Set a timeout for the navigation
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT_MS
    });

    const loadTime = Date.now() - startTime;

    // Check if we see the loading screen or actual content
    const bodyText = await page.evaluate(() => document.body.textContent);
    const hasJamraLoader = await page.evaluate(() => {
      const titleEl = document.querySelector('h1');
      return titleEl?.textContent?.includes('JAMRA');
    });

    const hasActualContent = bodyText.includes('Browse') ||
                            bodyText.includes('Library') ||
                            bodyText.includes('History');

    console.log(`  ⏱️  Load time: ${loadTime}ms`);
    console.log(`  📄 Has JAMRA loader: ${hasJamraLoader}`);
    console.log(`  ✨ Has actual content: ${hasActualContent}`);

    if (loadTime > 5000) {
      console.log(`  ⚠️  WARNING: Page took > 5 seconds to load`);
    }

    if (!hasActualContent && hasJamraLoader) {
      console.log(`  ❌ STUCK ON LOADING SCREEN!`);
      return false;
    }

    console.log(`  ✅ ${testName} passed (${loadTime}ms)`);
    return true;

  } catch (error) {
    const loadTime = Date.now() - startTime;
    console.error(`  ❌ ${testName} failed after ${loadTime}ms: ${error.message}`);
    return false;
  } finally {
    await page.close();
  }
}

async function cleanup() {
  console.log('\n[TEST] Cleaning up...');

  if (browser) {
    await browser.close();
  }

  if (catalogProcess) {
    catalogProcess.kill('SIGTERM');
  }

  if (nextProcess) {
    nextProcess.kill('SIGTERM');
  }

  await setTimeout(2000); // Give processes time to clean up
}

async function main() {
  console.log('='.repeat(60));
  console.log('JAMRA Startup Test');
  console.log('='.repeat(60));

  try {
    // Start servers
    await startCatalogServer();
    await startNextServer();

    // Launch browser
    console.log('[TEST] Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('[TEST] ✅ Browser launched');

    // Test 1: Initial page load
    const test1 = await testPageLoad(APP_URL, 'Initial page load');

    // Test 2: Reload (simulating user pressing reload)
    const test2 = await testPageLoad(APP_URL, 'Page reload');

    // Test 3: Navigation to a different page
    const test3 = await testPageLoad(`${APP_URL}/library`, 'Navigate to Library');

    console.log('\n' + '='.repeat(60));
    console.log('Test Results:');
    console.log('='.repeat(60));
    console.log(`Initial Load:  ${test1 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Page Reload:   ${test2 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Navigation:    ${test3 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('='.repeat(60));

    const allPassed = test1 && test2 && test3;
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error(`\n[TEST] ❌ Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n[TEST] Received SIGINT, cleaning up...');
  await cleanup();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n[TEST] Received SIGTERM, cleaning up...');
  await cleanup();
  process.exit(1);
});

main();
