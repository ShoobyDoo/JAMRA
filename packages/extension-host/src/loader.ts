import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ExtensionFactory, ExtensionModule } from "@jamra/extension-sdk";
import { validateManifest } from "./manifest.js";
import { ExtensionLoadError } from "./errors.js";

async function resolveModule(
  factoryOrModule: unknown,
): Promise<ExtensionModule> {
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
    return factoryOrModule as ExtensionModule;
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

  try {
    const imported = await import(moduleUrl);
    const candidate =
      imported.default ??
      imported.extension ??
      imported.factory ??
      imported.Extension ??
      imported;
    const extension = await resolveModule(candidate);
    validateManifest(extension.manifest);
    return extension;
  } catch (error) {
    if (error instanceof ExtensionLoadError) throw error;
    throw new ExtensionLoadError(
      `Failed to load extension from ${filePath}`,
      error,
    );
  }
}
