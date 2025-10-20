#!/usr/bin/env node

/**
 * Fix SQLite bindings for Electron/Node compatibility
 *
 * This script ensures better-sqlite3 works in both:
 * - Node.js (for web dev with pnpm dev)
 * - Electron (for desktop with pnpm desktop:dev)
 *
 * The core issue: better-sqlite3 checks build/Release/ first, which may have
 * the wrong ABI. We force it to use lib/binding/ instead.
 */

import { readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

async function findBetterSqlite() {
  const pnpmDir = path.join(repoRoot, "node_modules", ".pnpm");
  if (!existsSync(pnpmDir)) return null;

  const entries = await readdir(pnpmDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("better-sqlite3@")) {
      const modulePath = path.join(
        pnpmDir,
        entry.name,
        "node_modules",
        "better-sqlite3",
      );
      if (existsSync(modulePath)) return modulePath;
    }
  }
  return null;
}

async function main() {
  console.log(">> Fixing SQLite bindings...");

  const moduleDir = await findBetterSqlite();
  if (!moduleDir) {
    console.log("   better-sqlite3 not found, skipping");
    return;
  }

  const buildDir = path.join(moduleDir, "build");
  const bindingDir = path.join(moduleDir, "lib", "binding");

  // Check if bindings exist in lib/binding/
  if (!existsSync(bindingDir)) {
    console.log("   No bindings found in lib/binding/, skipping");
    return;
  }

  const bindings = await readdir(bindingDir, { withFileTypes: true });
  const hasBindings = bindings.some(
    (e) =>
      e.isDirectory() &&
      (e.name.startsWith("node-v") || e.name.startsWith("electron-v")),
  );

  if (!hasBindings) {
    console.log("   No valid bindings found, skipping");
    return;
  }

  // CRITICAL: Remove build/ directory entirely to force lib/binding/ usage
  // This prevents ABI mismatch errors in Electron
  if (existsSync(buildDir)) {
    await rm(buildDir, { recursive: true, force: true });
    console.log("✓ Removed build/ directory to force lib/binding/ usage");
  }

  // Also clean up any stale bindings in the pnpm cache
  const cachePattern = path.join(
    repoRoot,
    "node_modules",
    ".pnpm",
    "better-sqlite3@*",
  );
  const cacheGlob = cachePattern.replace(/\*/g, "");

  try {
    const pnpmEntries = await readdir(path.dirname(cacheGlob), {
      withFileTypes: true,
    });
    for (const entry of pnpmEntries) {
      if (entry.isDirectory() && entry.name.startsWith("better-sqlite3@")) {
        const cacheBuild = path.join(
          path.dirname(cacheGlob),
          entry.name,
          "node_modules",
          "better-sqlite3",
          "build",
        );
        if (existsSync(cacheBuild)) {
          await rm(cacheBuild, { recursive: true, force: true });
        }
      }
    }
  } catch {
    // Ignore cache cleanup errors
  }

  console.log("✓ SQLite bindings ready for both Node and Electron");
}

main().catch((error) => {
  console.error("Error fixing SQLite bindings:", error);
  process.exit(1);
});
