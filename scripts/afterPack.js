// afterPack hook for electron-builder
// Handles better-sqlite3 native module bindings for each platform

const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
  const { electronPlatformName, appOutDir } = context;

  console.log(`[afterPack] Running for platform: ${electronPlatformName}`);
  console.log(`[afterPack] App output directory: ${appOutDir}`);

  // Find the better-sqlite3 module in the app
  const sqliteModulePath = path.join(
    appOutDir,
    electronPlatformName === 'darwin' ? 'JAMRA.app/Contents/Resources/app.asar.unpacked' : 'resources/app.asar.unpacked',
    'node_modules/better-sqlite3'
  );

  if (!fs.existsSync(sqliteModulePath)) {
    console.warn(`[afterPack] better-sqlite3 not found at ${sqliteModulePath}`);
    return;
  }

  console.log(`[afterPack] Found better-sqlite3 at ${sqliteModulePath}`);

  // The native bindings should already be built for the correct platform by electron-builder
  // Just verify they exist
  const bindingDir = path.join(sqliteModulePath, 'lib/binding');

  if (fs.existsSync(bindingDir)) {
    const bindings = fs.readdirSync(bindingDir);
    console.log(`[afterPack] ✓ Found bindings:`, bindings);
  } else {
    console.warn(`[afterPack] Warning: No bindings directory found at ${bindingDir}`);
  }

  // Clean up build artifacts to reduce package size
  const buildDir = path.join(sqliteModulePath, 'build');
  if (fs.existsSync(buildDir)) {
    console.log(`[afterPack] Cleaning build directory to reduce size`);
    fs.rmSync(buildDir, { recursive: true, force: true });
  }

  console.log(`[afterPack] ✓ Completed for ${electronPlatformName}`);
};
