import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { AppContext } from "../../../app/context.js";
import type { ExtensionManifest } from "@jamra/extension-sdk";
import type {
  ExtensionLoader,
  ExtensionRecord,
  ExtensionRegistry,
} from "../extensions.types.js";

interface LocalManifest {
  manifest: ExtensionManifest;
  directory: string;
}

const readManifest = (directory: string): LocalManifest | null => {
  const manifestPath = path.join(directory, "manifest.json");
  if (!existsSync(manifestPath)) {
    return null;
  }

  const contents = readFileSync(manifestPath, "utf-8");
  const manifest = JSON.parse(contents) as ExtensionManifest;
  return { manifest, directory };
};

export const registerLocalExtensions = async (
  context: AppContext,
  registry: ExtensionRegistry,
  loader: ExtensionLoader,
): Promise<void> => {
  const installDir = path.resolve(
    process.cwd(),
    context.config.extensions.installDir,
  );

  if (!existsSync(installDir)) {
    context.logger.warn("Extension install directory does not exist", {
      installDir,
    });
    return;
  }

  const entries = readdirSync(installDir, { withFileTypes: true });
  const manifests: LocalManifest[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directory = path.join(installDir, entry.name);
    if (!statSync(directory).isDirectory()) {
      continue;
    }

    const manifest = readManifest(directory);
    if (manifest) {
      manifests.push(manifest);
    }
  }

  for (const { manifest, directory } of manifests) {
    try {
      const extensionRecord: ExtensionRecord = {
        id: manifest.id,
        slug: manifest.id,
        name: manifest.name,
        version: manifest.version,
        installPath: directory,
        enabled: true,
        repoSource: "local",
        manifest,
        installedAt: new Date(),
      };

      await registry.upsert(extensionRecord);
      let precompiled = false;
      try {
        await loader.loadSource(extensionRecord);
        precompiled = true;
      } catch (compileError) {
        context.logger.error("Failed to compile extension during preload", {
          extensionId: manifest.id,
          directory,
          error: compileError,
        });
      }

      context.logger.info("Registered local extension", {
        extensionId: manifest.id,
        directory,
        precompiled,
      });
    } catch (error) {
      context.logger.error("Failed to register local extension", {
        extensionId: manifest.id,
        directory,
        error,
      });
    }
  }
};
