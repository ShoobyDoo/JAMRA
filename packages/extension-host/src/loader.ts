import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ExtensionFactory, ExtensionModule } from "@jamra/extension-sdk";
import { validateManifest } from "./manifest.js";
import { ExtensionLoadError } from "./errors.js";

async function resolveModule(
  factoryOrModule: unknown,
): Promise<ExtensionModule> {
  console.log('[ExtensionLoader] Resolving module:', {
    type: typeof factoryOrModule,
    isNull: factoryOrModule === null,
    isUndefined: factoryOrModule === undefined,
    keys: typeof factoryOrModule === 'object' && factoryOrModule !== null
      ? Object.keys(factoryOrModule)
      : [],
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
    console.log('[ExtensionLoader] ✓ Found valid extension module with manifest and handlers');
    return factoryOrModule as ExtensionModule;
  }

  // Log structure for debugging
  if (typeof factoryOrModule === "object" && factoryOrModule !== null) {
    const keys = Object.keys(factoryOrModule);
    const moduleWithDefault = factoryOrModule as Record<string, unknown>;
    const hasDefault = 'default' in factoryOrModule;
    const defaultValue = hasDefault ? moduleWithDefault.default : null;
    const defaultKeys = defaultValue !== null && typeof defaultValue === 'object' && defaultValue !== null
      ? Object.keys(defaultValue as Record<string, unknown>)
      : null;

    console.error('[ExtensionLoader] ✗ Module structure:', {
      keys,
      hasManifest: 'manifest' in factoryOrModule,
      hasHandlers: 'handlers' in factoryOrModule,
      firstLevelKeys: keys,
      // Check nested defaults
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

  console.log('[ExtensionLoader] Importing extension from:', filePath);
  console.log('[ExtensionLoader] Resolved path:', resolvedPath);
  console.log('[ExtensionLoader] Module URL:', moduleUrl);

  try {
    const imported = await import(moduleUrl);
    console.log('[ExtensionLoader] Import successful, analyzing structure:', {
      importedKeys: Object.keys(imported),
      hasDefault: !!imported.default,
      hasExtension: !!imported.extension,
      hasFactory: !!imported.factory,
      hasExtension2: !!imported.Extension,
      defaultType: typeof imported.default,
      defaultKeys: imported.default && typeof imported.default === 'object'
        ? Object.keys(imported.default)
        : null,
    });

    const candidate =
      imported.default ??
      imported.extension ??
      imported.factory ??
      imported.Extension ??
      imported;

    console.log('[ExtensionLoader] Selected candidate for resolution');
    const extension = await resolveModule(candidate);
    validateManifest(extension.manifest);
    console.log('[ExtensionLoader] ✓ Extension loaded successfully:', extension.manifest.name);
    return extension;
  } catch (error) {
    console.error('[ExtensionLoader] ✗ Failed to import extension:', error);
    if (error instanceof ExtensionLoadError) throw error;
    throw new ExtensionLoadError(
      `Failed to load extension from ${filePath}`,
      error,
    );
  }
}
