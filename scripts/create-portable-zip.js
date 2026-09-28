import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const releaseDir = path.join(projectRoot, "src-tauri", "target", "release");
const artifactsDir = path.join(releaseDir, "artifacts");
const bundleDir = path.join(releaseDir, "bundle");
const outputDir = path.join(bundleDir, "portable");

const version = "1.0.0"; // Could read from package.json or tauri.conf.json

const createPortableZip = async () => {
  console.log("Creating portable ZIP package...");

  // Ensure output directory exists
  await fs.ensureDir(outputDir);

  const outputPath = path.join(outputDir, `JAMRA_${version}_portable.zip`);
  const output = fs.createWriteStream(outputPath);
  const archive = archiver("zip", {
    zlib: { level: 9 }, // Maximum compression
  });

  // Handle archive events
  output.on("close", () => {
    const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log(`✓ Portable ZIP created: ${outputPath}`);
    console.log(`  Size: ${sizeMB} MB`);
  });

  archive.on("error", (err) => {
    throw err;
  });

  archive.on("warning", (err) => {
    if (err.code === "ENOENT") {
      console.warn("Warning:", err);
    } else {
      throw err;
    }
  });

  // Pipe archive data to the file
  archive.pipe(output);

  // Add executable
  const isWindows = process.platform === "win32";
  const exeName = isWindows ? "jamra.exe" : "jamra";
  const exePath = path.join(artifactsDir, exeName);
  if (!(await fs.pathExists(exePath))) {
    throw new Error(
      `${exeName} not found at ${exePath}. Run build first: pnpm tauri build --no-bundle`,
    );
  }
  console.log(`  Adding ${exeName}...`);
  archive.file(exePath, { name: `JAMRA/${exeName}`, mode: 0o755 });

  // Add server bundle
  const serverBundlePath = path.join(artifactsDir, "server-bundle");
  if (await fs.pathExists(serverBundlePath)) {
    console.log("  Adding server-bundle...");
    archive.directory(serverBundlePath, "JAMRA/server-bundle");
  } else {
    console.warn(
      `Warning: server-bundle not found at ${serverBundlePath}. The portable package may not work correctly.`,
    );
  }

  // Add resources
  const resourcesPath = path.join(artifactsDir, "resources");
  if (await fs.pathExists(resourcesPath)) {
    console.log("  Adding resources...");
    archive.directory(resourcesPath, "JAMRA/resources");
  }

  // Add Node runtime
  const nodeRuntimePath = path.join(artifactsDir, "node-runtime");
  if (await fs.pathExists(nodeRuntimePath)) {
    console.log("  Adding node-runtime...");
    archive.directory(nodeRuntimePath, "JAMRA/node-runtime");
  } else {
    console.warn(
      `Warning: node-runtime not found at ${nodeRuntimePath}. The portable package will require Node.js on the host.`,
    );
  }

  // Add SDK packages
  const packagesPath = path.join(artifactsDir, "packages");
  if (await fs.pathExists(packagesPath)) {
    console.log("  Adding packages...");
    archive.directory(packagesPath, "JAMRA/packages");
  }

  // Create and add README
  const readme = `JAMRA - Portable Version
========================

Version: ${version}

SYSTEM REQUIREMENTS
-------------------
1. Microsoft Edge WebView2 Runtime
   - Usually pre-installed on Windows 10/11
   - Download: https://developer.microsoft.com/microsoft-edge/webview2/

2. Microsoft Visual C++ Redistributable (latest)
   - Download: https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist

HOW TO USE
----------
1. Extract this ZIP to a folder of your choice
2. Double-click ${exeName} to launch the application

PORTABLE MODE
-------------
This portable package contains:
- ${exeName} (main application)
- server-bundle/ (Node.js server files)
- resources/ (application resources)
- packages/ (SDK files)
- node-runtime/ (bundled Node.js runtime)

All data will be stored in:
  %APPDATA%\\com.shoobydoo.jamra

TROUBLESHOOTING
---------------
If the application doesn't start:
1. Check that ${exeName} is not blocked: Right-click > Properties > Unblock
2. Confirm node-runtime/node${isWindows ? '.exe' : ''} exists inside this folder
3. Run ${exeName} from Command Prompt to see error messages

For support, visit: https://github.com/yourusername/jamra

LICENSE
-------
[Your license information here]
`;

  console.log("  Adding README.txt...");
  archive.append(readme, { name: "JAMRA/README.txt" });

  // Finalize the archive
  console.log("  Finalizing archive...");
  await archive.finalize();
};

// Run the script
createPortableZip().catch((error) => {
  console.error("Error creating portable ZIP:", error);
  process.exit(1);
});
