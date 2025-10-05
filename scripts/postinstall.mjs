#!/usr/bin/env node

import { readdir, cp, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

/**
 * Postinstall hook to ensure better-sqlite3 bindings are correct for both Node and Electron
 * This runs automatically after every `pnpm install` to fix the binding issue
 */

async function findBetterSqliteModule() {
  const pnpmDir = path.join(repoRoot, "node_modules", ".pnpm");

  if (!existsSync(pnpmDir)) {
    return null;
  }

  // Find better-sqlite3 in .pnpm directory
  const entries = await readdir(pnpmDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("better-sqlite3@")) {
      const modulePath = path.join(pnpmDir, entry.name, "node_modules", "better-sqlite3");
      if (existsSync(modulePath)) {
        return modulePath;
      }
    }
  }

  return null;
}

async function findElectronBinding(bindingDir) {
  if (!existsSync(bindingDir)) {
    return null;
  }

  const entries = await readdir(bindingDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("electron-v")) {
      const bindingFile = path.join(bindingDir, entry.name, "better_sqlite3.node");
      if (existsSync(bindingFile)) {
        return { path: bindingFile, dirname: entry.name };
      }
    }
  }

  return null;
}

function extractElectronAbi(electronDirName) {
  // Extract ABI number from electron-v139-linux-x64 format
  const match = electronDirName.match(/electron-v(\d+)-/);
  return match ? match[1] : null;
}

async function main() {
  const moduleDir = await findBetterSqliteModule();

  if (!moduleDir) {
    // better-sqlite3 not installed yet, skip
    process.exit(0);
  }

  const bindingDir = path.join(moduleDir, "lib", "binding");
  const buildRelease = path.join(moduleDir, "build", "Release", "better_sqlite3.node");

  // Get the actual Node version being used
  const nodeVersion = process.versions.modules;

  // Detect platform and arch
  const platform = process.platform;
  const arch = process.arch;
  const platformArch = `${platform}-${arch}`;

  // Check if we have Electron bindings
  const electronBinding = await findElectronBinding(bindingDir);

  if (!electronBinding) {
    // No Electron binding found, nothing to fix
    process.exit(0);
  }

  const electronAbi = extractElectronAbi(electronBinding.dirname);

  if (!electronAbi) {
    // Can't parse ABI, skip
    process.exit(0);
  }

  // 1. Ensure the node-v{ELECTRON_ABI} directory exists with Electron binding
  const nodeBindingDir = path.join(bindingDir, `node-v${electronAbi}-${platformArch}`);
  const nodeBindingFile = path.join(nodeBindingDir, "better_sqlite3.node");

  if (!existsSync(nodeBindingFile)) {
    await mkdir(nodeBindingDir, { recursive: true });
    await cp(electronBinding.path, nodeBindingFile);

    if (!existsSync(path.join(nodeBindingDir, "better_sqlite3.node"))) {
      console.log(`✓ Created node-v${electronAbi} binding for Electron compatibility`);
    } else {
      console.log(`✓ Restored node-v${electronAbi} binding for Electron compatibility`);
    }
  }

  // 2. Ensure Node binding exists in lib/binding (copy from build/Release if present)
  if (existsSync(buildRelease) && nodeVersion) {
    const nodeBindingForNode = path.join(
      bindingDir,
      `node-v${nodeVersion}-${platformArch}`,
      "better_sqlite3.node"
    );

    if (!existsSync(nodeBindingForNode)) {
      await mkdir(path.dirname(nodeBindingForNode), { recursive: true });
      await cp(buildRelease, nodeBindingForNode);
      console.log(`✓ Preserved node-v${nodeVersion} binding for web development`);
    }
  }

  // 3. CRITICAL FIX: Remove build/Release to force better-sqlite3 to use lib/binding
  // This prevents the ABI mismatch issue in Electron
  if (existsSync(buildRelease)) {
    await rm(buildRelease, { force: true });
    console.log("✓ Removed build/Release binding to force library selection from lib/binding/");
  }

  console.log(`✓ SQLite bindings configured for both Node ${nodeVersion} and Electron (ABI ${electronAbi})`);
}

main().catch((error) => {
  console.error("Postinstall script failed:", error);
  // Don't fail the install, just warn
  process.exit(0);
});
