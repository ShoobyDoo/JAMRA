import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ExtensionFactory, ExtensionModule } from "@jamra/extension-sdk";
import { validateManifest } from "./manifest.js";
import { ExtensionLoadError } from "./errors.js";
import { createLogger } from "./logger.js";

const logger = createLogger("ExtensionLoader", "debug");

async function resolveModule(
  factoryOrModule: unknown,
): Promise<ExtensionModule> {
  logger.debug("Resolving module", {
    type: typeof factoryOrModule,
    isNull: factoryOrModule === null,
    isUndefined: factoryOrModule === undefined,
    hasKeys: typeof factoryOrModule === "object" && factoryOrModule !== null,
  });

  if (!factoryOrModule) {
    throw new ExtensionLoadError(
      "Extension entry module is empty or undefined.",
    );
  }

  if (typeof factoryOrModule === "function") {
    const result = await (factoryOrModule as ExtensionFactory)();
    return resolveModule(result);
  }

  if (
    typeof factoryOrModule === "object" &&
    "manifest" in factoryOrModule &&
    "handlers" in factoryOrModule
  ) {
    logger.debug("Found valid extension module with manifest and handlers");
    return factoryOrModule as ExtensionModule;
  }

  if (typeof factoryOrModule === "object" && factoryOrModule !== null) {
    const keys = Object.keys(factoryOrModule);
    const moduleWithDefault = factoryOrModule as Record<string, unknown>;
    const hasDefault = "default" in factoryOrModule;
    const defaultValue = hasDefault ? moduleWithDefault.default : null;
    const defaultKeys =
      defaultValue !== null &&
      typeof defaultValue === "object" &&
      defaultValue !== null
        ? Object.keys(defaultValue as Record<string, unknown>)
        : null;

    logger.error("Invalid module structure", {
      keys,
      hasManifest: "manifest" in factoryOrModule,
      hasHandlers: "handlers" in factoryOrModule,
      hasDefault,
      defaultKeys,
    });
  }

  throw new ExtensionLoadError(
    "Extension module does not export a valid manifest/handlers pair.",
  );
}

export async function importExtension(
  filePath: string,
): Promise<ExtensionModule> {
  const resolvedPath = path.resolve(filePath);
  const moduleUrl = pathToFileURL(resolvedPath).href;

  logger.debug("Importing extension", {
    filePath,
    resolvedPath,
    moduleUrl,
  });

  try {
    const imported = await import(moduleUrl);
    logger.debug("Import successful, analyzing structure", {
      importedKeys: Object.keys(imported),
      hasDefault: !!imported.default,
      hasExtension: !!imported.extension,
      hasFactory: !!imported.factory,
      defaultType: typeof imported.default,
    });

    const candidate =
      imported.default ??
      imported.extension ??
      imported.factory ??
      imported.Extension ??
      imported;

    logger.debug("Selected candidate for resolution");
    const extension = await resolveModule(candidate);
    validateManifest(extension.manifest);
    logger.info("Extension loaded successfully", {
      name: extension.manifest.name,
      id: extension.manifest.id,
      version: extension.manifest.version,
    });
    return extension;
  } catch (error) {
    logger.error("Failed to import extension", {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof ExtensionLoadError) throw error;
    throw new ExtensionLoadError(
      `Failed to load extension from ${filePath}`,
      error,
    );
  }
}
