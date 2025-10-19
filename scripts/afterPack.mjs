// afterPack hook for electron-builder
// Handles better-sqlite3 native module bindings for each platform

import fs from "node:fs";
import path from "node:path";

function resolveBetterSqliteModule(nodeModulesDir) {
  const directPath = path.join(nodeModulesDir, "better-sqlite3");
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  const pnpmDir = path.join(nodeModulesDir, ".pnpm");
  if (fs.existsSync(pnpmDir)) {
    const entries = fs.readdirSync(pnpmDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("better-sqlite3@")) {
        continue;
      }

      const candidate = path.join(
        pnpmDir,
        entry.name,
        "node_modules",
        "better-sqlite3",
      );
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function findProjectBetterSqliteModule(projectDir) {
  const pnpmDir = path.join(projectDir, "node_modules", ".pnpm");
  if (!fs.existsSync(pnpmDir)) {
    return null;
  }

  const entries = fs.readdirSync(pnpmDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("better-sqlite3@")) {
      continue;
    }

    const modulePath = path.join(
      pnpmDir,
      entry.name,
      "node_modules",
      "better-sqlite3",
    );
    if (fs.existsSync(modulePath)) {
      return modulePath;
    }
  }

  return null;
}

function copyModuleIntoUnpacked(sourceDir, destinationDir) {
  fs.mkdirSync(path.dirname(destinationDir), { recursive: true });
  if (fs.existsSync(destinationDir)) {
    fs.rmSync(destinationDir, { recursive: true, force: true });
  }
  fs.cpSync(sourceDir, destinationDir, { recursive: true, dereference: true });
  return destinationDir;
}

export default async function afterPack(context) {
  const { electronPlatformName, arch, appOutDir } = context;
  const archLabels = {
    0: "ia32",
    1: "x64",
    2: "armv7l",
    3: "arm64",
    4: "universal",
  };
  const archKey = typeof arch === "string" ? Number.parseInt(arch, 10) : arch;
  let archLabel =
    archKey != null && !Number.isNaN(archKey) ? archLabels[archKey] : null;
  if (!archLabel && typeof arch === "string" && arch.length > 0) {
    archLabel = arch;
  }
  if (!archLabel) {
    const dirName = path.basename(appOutDir);
    if (dirName.includes("arm64")) {
      archLabel = "arm64";
    } else if (dirName.includes("armv7")) {
      archLabel = "armv7l";
    } else if (dirName.includes("ia32") || dirName.includes("x86")) {
      archLabel = "ia32";
    } else if (dirName.includes("x64") || dirName.includes("amd64")) {
      archLabel = "x64";
    }
  }
  const platformKey = archLabel
    ? `${electronPlatformName}-${archLabel}`
    : electronPlatformName;

  console.log(`[afterPack] Running for ${platformKey}`);
  console.log(`[afterPack] App output directory: ${appOutDir}`);

  // Find the better-sqlite3 module in the app
  const resourcesDir =
    electronPlatformName === "darwin"
      ? path.join(appOutDir, "JAMRA.app", "Contents", "Resources")
      : path.join(appOutDir, "resources");
  const unpackedNodeModulesDir = path.join(
    resourcesDir,
    "app.asar.unpacked",
    "node_modules",
  );
  let sqliteModulePath = resolveBetterSqliteModule(unpackedNodeModulesDir);

  if (!sqliteModulePath) {
    const projectModule = findProjectBetterSqliteModule(
      context.packager.projectDir,
    );
    if (projectModule) {
      console.log(
        `[afterPack] better-sqlite3 missing for ${platformKey}, copying from project cache`,
      );
      const targetDir = path.join(unpackedNodeModulesDir, "better-sqlite3");
      sqliteModulePath = copyModuleIntoUnpacked(projectModule, targetDir);
    }
  }

  if (!sqliteModulePath) {
    console.warn(
      `[afterPack] better-sqlite3 not found in ${unpackedNodeModulesDir} for ${platformKey} and no fallback copy available`,
    );
    return;
  }

  console.log(`[afterPack] Found better-sqlite3 at ${sqliteModulePath}`);

  // The native bindings should already be built for the correct platform by electron-builder
  // Just verify they exist
  const bindingDir = path.join(sqliteModulePath, "lib/binding");

  if (fs.existsSync(bindingDir)) {
    const bindings = fs.readdirSync(bindingDir);
    console.log(`[afterPack] ✓ Found bindings:`, bindings);
  } else {
    console.warn(
      `[afterPack] Warning: No bindings directory found at ${bindingDir}`,
    );
  }

  // Clean up build artifacts to reduce package size
  const buildDir = path.join(sqliteModulePath, "build");
  if (fs.existsSync(buildDir)) {
    console.log(`[afterPack] Cleaning build directory to reduce size`);
    fs.rmSync(buildDir, { recursive: true, force: true });
  }

  console.log(`[afterPack] ✓ Completed for ${platformKey}`);
}
