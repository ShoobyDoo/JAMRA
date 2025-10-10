#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("close", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

function posixify(inputPath) {
  return inputPath.split(path.sep).join("/");
}

async function collectPaths(rootDir) {
  const directories = new Set();
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relative = path.relative(rootDir, absolutePath);
      if (!relative) continue;
      const rpmPath = `/${posixify(relative)}`;

      if (entry.isDirectory()) {
        directories.add(rpmPath);
        await walk(absolutePath);
      } else {
        files.push(rpmPath);
      }
    }
  }

  await walk(rootDir);

  const sortedDirs = Array.from(directories).sort((a, b) => {
    const depthDiff = a.split("/").length - b.split("/").length;
    return depthDiff === 0 ? a.localeCompare(b) : depthDiff;
  });
  const sortedFiles = files.sort((a, b) => a.localeCompare(b));

  return {
    directories: sortedDirs,
    files: sortedFiles
  };
}

async function ensureIcon(size, buildRoot) {
  const sourcePath = path.join(repoRoot, "build", "icons", `${size}x${size}.png`);
  if (!(await pathExists(sourcePath))) {
    throw new Error(`Icon missing: ${path.relative(repoRoot, sourcePath)}`);
  }
  const destinationDir = path.join(buildRoot, "usr", "share", "icons", "hicolor", `${size}x${size}`, "apps");
  await fs.mkdir(destinationDir, { recursive: true });
  await fs.copyFile(sourcePath, path.join(destinationDir, "jamra.png"));
}

async function createDesktopFile(buildRoot) {
  const desktopDir = path.join(buildRoot, "usr", "share", "applications");
  await fs.mkdir(desktopDir, { recursive: true });
  const desktopPath = path.join(desktopDir, "jamra.desktop");
  const desktopContent = [
    "[Desktop Entry]",
    "Type=Application",
    "Name=JAMRA",
    "Comment=Extensible manga reader",
    "Exec=/opt/JAMRA/jamra %U",
    "Icon=jamra",
    "Terminal=false",
    "Categories=Entertainment;",
    ""
  ].join("\n");
  await fs.writeFile(desktopPath, desktopContent, "utf8");
}

async function copyApplicationPayload(sourceDir, buildRoot) {
  const destination = path.join(buildRoot, "opt", "JAMRA");
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(sourceDir, destination, { recursive: true });
}

async function directoryHasContent(directoryPath) {
  try {
    const entries = await fs.readdir(directoryPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function normalizeDuplicateArtifacts(rootDir) {
  async function processDirectory(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    const entryMap = new Map(entries.map(entry => [entry.name, entry]));

    for (const entry of entries) {
      const match = entry.name.match(/^(.*) (\d+)$/);
      if (!match) continue;

      const baseName = match[1];
      const duplicatePath = path.join(currentDir, entry.name);
      const baseEntry = entryMap.get(baseName);

      const duplicateHasContent = entry.isDirectory()
        ? await directoryHasContent(duplicatePath)
        : true;

      if (baseEntry) {
        const basePath = path.join(currentDir, baseName);
        const baseHasContent = baseEntry.isDirectory()
          ? await directoryHasContent(basePath)
          : true;

        if (!baseHasContent && duplicateHasContent) {
          await fs.rm(basePath, { recursive: true, force: true });
          await fs.rename(duplicatePath, basePath);
        } else {
          await fs.rm(duplicatePath, { recursive: true, force: true });
        }
      } else {
        const targetPath = path.join(currentDir, baseName);
        await fs.rename(duplicatePath, targetPath);
      }
    }

    const refreshedEntries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const refreshedEntry of refreshedEntries) {
      if (refreshedEntry.isDirectory()) {
        await processDirectory(path.join(currentDir, refreshedEntry.name));
      }
    }
  }

  await processDirectory(rootDir);
}

async function packageRpmForArch(config, version) {
  const hostArch = process.arch;
  const isSupported =
    (config.rpmArch === "x86_64" && hostArch === "x64") ||
    (config.rpmArch === "aarch64" && (hostArch === "arm64" || hostArch === "aarch64")) ||
    (config.rpmArch !== "x86_64" && config.rpmArch !== "aarch64");

  if (!isSupported) {
    console.warn(
      `[packagerpm] Skipping ${config.rpmArch}: run this script on a ${config.rpmArch} host or under an emulator to build the RPM`
    );
    return;
  }

  if (!(await pathExists(config.sourceDir))) {
    console.warn(`[packagerpm] Skipping ${config.rpmArch}: missing ${path.relative(repoRoot, config.sourceDir)}`);
    return;
  }

  console.log(`[packagerpm] Building RPM for ${config.rpmArch}`);
  const workspace = path.join(repoRoot, "dist-electron", `rpm-build-${config.rpmArch}`);
  await fs.rm(workspace, { recursive: true, force: true });

  const subdirs = ["BUILD", "RPMS", "SOURCES", "SPECS", "SRPMS", "BUILDROOT", "TMP", "payload"];
  await Promise.all(subdirs.map(dir => fs.mkdir(path.join(workspace, dir), { recursive: true })));

  const rpmBaseName = `jamra-${version}-1.${config.rpmArch}`;
  const payloadRoot = path.join(workspace, "payload", rpmBaseName);
  await fs.rm(payloadRoot, { recursive: true, force: true });
  await fs.mkdir(payloadRoot, { recursive: true });
  await copyApplicationPayload(config.sourceDir, payloadRoot);
  await normalizeDuplicateArtifacts(payloadRoot);

  const iconSizes = [16, 24, 32, 48, 64, 128, 256, 512];
  await Promise.all(iconSizes.map(size => ensureIcon(size, payloadRoot)));

  await createDesktopFile(payloadRoot);

  const tarballPath = path.join(workspace, "SOURCES", "payload.tar.gz");
  await run("tar", ["-czf", tarballPath, "-C", payloadRoot, "."]);

  const { directories, files } = await collectPaths(payloadRoot);
  const directoryEntries = directories.map(dir => `%dir ${dir}`);
  const fileEntries = files;
  const fileSection = [...directoryEntries, ...fileEntries].join("\n");

  const specContent = [
    "Name: jamra",
    `Version: ${version}`,
    "Release: 1",
    "Summary: Extensible manga reader with SQLite-backed catalog and desktop shell",
    "License: MIT",
    "Vendor: JAMRA Team",
    "URL: https://github.com/ShoobyDoo/JAMRA",
    "BuildArch: %{_target_cpu}",
    "Group: Applications/Productivity",
    "AutoReqProv: no",
    "BuildRoot: %{_buildrootdir}/%{name}-%{version}-%{release}.%{_arch}",
    "Source0: payload.tar.gz",
    "Requires: gtk3",
    "Requires: libnotify",
    "Requires: nss",
    "Requires: libXScrnSaver",
    "Requires: (libXtst or libXtst6)",
    "Requires: xdg-utils",
    "Requires: at-spi2-core",
    "Requires: (libuuid or libuuid1)",
    "",
    "%description",
    "Extensible manga reader with SQLite-backed catalog and desktop shell.",
    "",
    "%prep",
    "%build",
    "%install",
    "rm -rf %{buildroot}",
    "mkdir -p %{buildroot}",
    "tar -xzf %{_sourcedir}/payload.tar.gz -C %{buildroot}",
    "",
    "%files",
    "%defattr(-,root,root,-)",
    fileSection,
    "",
    "%post",
    "#!/bin/sh",
    "exit 0",
    "",
    "%postun",
    "#!/bin/sh",
    "exit 0",
    "",
    "%changelog",
    ""
  ].join("\n");

  const specPath = path.join(workspace, "SPECS", `jamra-${config.rpmArch}.spec`);
  await fs.writeFile(specPath, specContent, "utf8");

  const rpmbuildArgs = [
    "-bb",
    "--define",
    `_topdir ${workspace}`,
    "--define",
    `_rpmdir ${path.join(workspace, "RPMS")}`,
    "--define",
    `_srcrpmdir ${path.join(workspace, "SRPMS")}`,
    "--define",
    `_builddir ${path.join(workspace, "BUILD")}`,
    "--define",
    `_buildrootdir ${path.join(workspace, "BUILDROOT")}`,
    "--define",
    `_sourcedir ${path.join(workspace, "SOURCES")}`,
    "--define",
    `_specdir ${path.join(workspace, "SPECS")}`,
    "--define",
    `_tmppath ${path.join(workspace, "TMP")}`,
    "--define",
    `_target_cpu ${config.rpmArch}`,
    "--define",
    `_target_os linux`,
    "--define",
    `_arch ${config.rpmArch}`,
    specPath
  ];

  await run("rpmbuild", rpmbuildArgs);

  const producedRpm = path.join(workspace, "RPMS", config.rpmArch, `${rpmBaseName}.rpm`);
  if (!(await pathExists(producedRpm))) {
    throw new Error(`Expected RPM not found at ${producedRpm}`);
  }

  const targetRpm = path.join(repoRoot, "dist-electron", `jamra-${version}.${config.rpmArch}.rpm`);
  await fs.copyFile(producedRpm, targetRpm);
  console.log(`[packagerpm] Wrote ${path.relative(repoRoot, targetRpm)}`);
}

async function main() {
  const pkg = await readJson(path.join(repoRoot, "package.json"));
  const version = pkg.version;
  if (!version) {
    throw new Error("package.json is missing a version field");
  }

  const archMatrix = [
    {
      rpmArch: "x86_64",
      sourceDir: path.join(repoRoot, "dist-electron", "linux-unpacked")
    },
    {
      rpmArch: "aarch64",
      sourceDir: path.join(repoRoot, "dist-electron", "linux-arm64-unpacked")
    }
  ];

  for (const config of archMatrix) {
    await packageRpmForArch(config, version);
  }
}

main().catch(error => {
  console.error("[packagerpm] Failed:", error);
  process.exit(1);
});
