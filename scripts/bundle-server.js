/**
 * Bundle Server Script
 * Copies server dist and required node_modules for Tauri bundling
 */

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const buildDir = path.join(rootDir, "build");
const bundleDir = path.join(buildDir, "server-bundle");
const serverDistDir = path.join(rootDir, "packages", "server", "dist");
const nodeModulesDir = path.join(rootDir, "node_modules");

// Dependencies that MUST be bundled (especially native modules)
const requiredDependencies = [
  "better-sqlite3",
  "express",
  "ws",
  "cors",
  "nanoid",
  "pino",
  "pino-roll",
  "pino-abstract-transport",
  "pino-std-serializers",
  "thread-stream",
  "on-exit-leak-free",
  "process-warning",
  "real-require",
  "safe-stable-stringify",
  "quick-format-unescaped",
  "atomic-sleep",
  "sonic-boom",
  "cheerio",
  "domhandler",
  // Add Express dependencies
  "body-parser",
  "cookie",
  "cookie-signature",
  "debug",
  "depd",
  "encodeurl",
  "escape-html",
  "etag",
  "finalhandler",
  "forwarded",
  "fresh",
  "http-errors",
  "merge-descriptors",
  "ms",
  "on-finished",
  "parseurl",
  "path-to-regexp",
  "proxy-addr",
  "qs",
  "range-parser",
  "safe-buffer",
  "send",
  "serve-static",
  "setprototypeof",
  "statuses",
  "type-is",
  "vary",
  // Cheerio dependencies
  "htmlparser2",
  "dom-serializer",
  "domelementtype",
  "domutils",
  "entities",
];

const optionalDependencies = [
  // Optional peer dependencies for `ws`
  "utf-8-validate",
  "bufferutil",
];

async function bundleServer() {
  console.log("📦 Bundling server for production...\n");

  try {
    // Validate that extensions directory won't be bundled
    console.log("🔒 Validating extension exclusion...");
    await validateExtensionsExcluded();

    // Clean bundle directory
    console.log("🧹 Cleaning bundle directory...");
    await fs.remove(bundleDir);
    await fs.ensureDir(bundleDir);

    // Copy server dist
    console.log("📋 Copying server dist...");
    await fs.copy(serverDistDir, path.join(bundleDir, "dist"));

    // Create node_modules directory in bundle
    const bundleNodeModules = path.join(bundleDir, "node_modules");
    await fs.ensureDir(bundleNodeModules);

    const bundledDependencies = new Set();

    const copyDependency = async (dep, { optional = false } = {}) => {
      const sourcePath = path.join(nodeModulesDir, dep);
      const targetPath = path.join(bundleNodeModules, dep);

      if (!(await fs.pathExists(sourcePath))) {
        if (optional) {
          console.log(`  • ${dep} (optional dependency not installed)`);
        } else {
          console.warn(`  ⚠️  ${dep} not found, skipping...`);
        }
        return;
      }

      await fs.copy(sourcePath, targetPath, {
        filter: (src) => {
          // Skip unnecessary files to reduce bundle size
          const relativePath = path.relative(sourcePath, src);

          // Skip test files, docs, examples
          if (relativePath.match(/\/(test|tests|docs|examples?|\.github)\//)) {
            return false;
          }

          // Skip markdown files except README
          if (
            relativePath.match(/\.md$/) &&
            !relativePath.match(/README\.md$/i)
          ) {
            return false;
          }

          return true;
        },
      });
      bundledDependencies.add(dep);
      console.log(`  ✓ ${dep}`);
    };

    // Copy required dependencies
    console.log("📦 Bundling dependencies...");
    for (const dep of requiredDependencies) {
      await copyDependency(dep);
    }

    if (optionalDependencies.length > 0) {
      console.log("\nℹ️ Checking optional dependencies...");
      for (const dep of optionalDependencies) {
        await copyDependency(dep, { optional: true });
      }
    }

    console.log("\n🧹 Pruning native build artifacts...");
    await pruneNativeBuildArtifacts(bundleNodeModules);

    // Create package.json for the bundle
    const dependencies = Array.from(bundledDependencies).sort().reduce(
      (acc, dep) => {
        acc[dep] = "*";
        return acc;
      },
      {},
    );

    const bundlePackageJson = {
      name: "jamra-server-bundle",
      version: "1.0.0",
      type: "module",
      main: "dist/index.js",
      dependencies,
    };

    await fs.writeJson(
      path.join(bundleDir, "package.json"),
      bundlePackageJson,
      { spaces: 2 },
    );

    const bundleSizeMB = ((await getFolderSize(bundleDir)) / 1024 / 1024).toFixed(
      2,
    );

    console.log("\n✅ Server bundle created successfully!");
    console.log("\n--- Build Summary ---");
    console.log(`📁 Output: ${bundleDir}`);
    console.log(`📦 Dependencies bundled: ${bundledDependencies.size}`);
    console.log(`📊 Bundle size: ${bundleSizeMB} MB`);
  } catch (error) {
    console.error("❌ Failed to bundle server:", error);
    process.exit(1);
  }
}

async function getFolderSize(folderPath) {
  let size = 0;
  const files = await fs.readdir(folderPath);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stats = await fs.stat(filePath);

    if (stats.isDirectory()) {
      size += await getFolderSize(filePath);
    } else {
      size += stats.size;
    }
  }

  return size;
}

async function pruneNativeBuildArtifacts(nodeModulesPath) {
  await pruneBetterSqlite3Artifacts(nodeModulesPath);
}

async function pruneBetterSqlite3Artifacts(nodeModulesPath) {
  const modulePath = path.join(nodeModulesPath, "better-sqlite3");
  if (!(await fs.pathExists(modulePath))) {
    return;
  }

  const buildDir = path.join(modulePath, "build");
  const releaseDir = path.join(buildDir, "Release");

  // Drop nested deps directories that only contain node-gyp build logs.
  await fs.remove(path.join(buildDir, "deps"));

  if (await fs.pathExists(releaseDir)) {
    const keepFiles = new Set(["better_sqlite3.node"]);
    const releaseEntries = await fs.readdir(releaseDir);
    for (const entry of releaseEntries) {
      if (!keepFiles.has(entry)) {
        await fs.remove(path.join(releaseDir, entry));
      }
    }
  }
}

/**
 * Validates that extensions directory is never bundled in production builds.
 * Extensions are for local development only and must not ship with the app.
 */
async function validateExtensionsExcluded() {
  const extensionsDir = path.join(rootDir, "resources", "extensions");
  const tauriConfigPath = path.join(rootDir, "src-tauri", "tauri.conf.json");

  // Check if extensions directory exists (it's okay if it doesn't)
  const extensionsExist = await fs.pathExists(extensionsDir);

  if (extensionsExist) {
    // Check if there are any extensions
    const entries = await fs.readdir(extensionsDir);
    const hasExtensions = entries.some(
      (entry) => entry !== ".gitkeep" && entry !== "README.md",
    );

    if (hasExtensions) {
      console.log(
        `  ℹ️  Found ${entries.length - 2} local extension(s) (will be excluded from bundle)`,
      );
    }
  }

  // Validate Tauri config doesn't reference extensions directory
  const tauriConfig = await fs.readJson(tauriConfigPath);
  const resources = tauriConfig.bundle?.resources || {};

  for (const [source, _target] of Object.entries(resources)) {
    const normalizedSource = source.replace(/\\/g, "/");
    if (
      normalizedSource.includes("resources/extensions") ||
      normalizedSource.includes("resources\\extensions")
    ) {
      throw new Error(
        `❌ FATAL: Tauri config references extensions directory!\n` +
          `   Source: ${source}\n` +
          `   Extensions are for local development only and must not be bundled.\n` +
          `   Remove this entry from src-tauri/tauri.conf.json`,
      );
    }
  }

  console.log("  ✓ Extensions directory will not be bundled (development only)");
}

bundleServer();
