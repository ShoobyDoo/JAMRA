/**
 * Extension Helper Utilities
 *
 * Utility functions for extension registry and metadata management
 */

import type {
  StoredExtensionSourceMetadata,
  StoredExtensionUpdateDetails,
} from "@jamra/catalog-db";
import type {
  RegistrySourceConfig,
  ResolvedExtensionVersion,
} from "../extensions/registryService.js";
import { fileURLToPath } from "node:url";

/**
 * Parse registry sources from environment variable (text format)
 */
export function parseRegistryEnv(value: string): RegistrySourceConfig[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry, index) => {
      const parts = entry
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length === 0) {
        throw new Error(
          `Invalid registry entry at position ${index + 1}: ${entry}`,
        );
      }

      let id: string | undefined;
      let url: string;
      let label: string | undefined;

      if (parts.length === 1) {
        url = parts[0];
      } else {
        [id, url, label] = parts;
      }

      return {
        id: id && id.length > 0 ? id : undefined,
        url,
        label,
        priority: index,
      } satisfies RegistrySourceConfig;
    });
}

/**
 * Parse registry sources from JSON environment variable
 */
export function parseRegistryJson(json: string): RegistrySourceConfig[] {
  try {
    const payload = JSON.parse(json) as Array<
      RegistrySourceConfig & { url: string }
    >;
    return payload
      .filter((entry) => typeof entry?.url === "string" && entry.url.length > 0)
      .map((entry, index) => ({
        id: entry.id,
        url: entry.url,
        label: entry.label,
        priority: entry.priority ?? index,
      }));
  } catch (error) {
    throw new Error(
      `JAMRA_EXTENSION_REGISTRIES_JSON is invalid JSON: ${String(error)}`,
    );
  }
}

/**
 * Resolve registry sources from environment or use default
 */
export function resolveRegistrySources(): RegistrySourceConfig[] {
  const jsonEnv = process.env.JAMRA_EXTENSION_REGISTRIES_JSON;
  if (jsonEnv && jsonEnv.trim().length > 0) {
    const parsed = parseRegistryJson(jsonEnv.trim());
    if (parsed.length > 0) {
      return parsed;
    }
  }

  const textEnv = process.env.JAMRA_EXTENSION_REGISTRIES;
  if (textEnv && textEnv.trim().length > 0) {
    const parsed = parseRegistryEnv(textEnv.trim());
    if (parsed.length > 0) {
      return parsed;
    }
  }

  const officialManifestPath = fileURLToPath(
    new URL("../extensions/registries/official.json", import.meta.url),
  );

  return [
    {
      id: "jamra-official",
      url: officialManifestPath,
      label: "JAMRA Official Registry",
      priority: 0,
    },
  ];
}

/**
 * Build source metadata from resolved extension version
 */
export function buildSourceMetadata(
  resolved: ResolvedExtensionVersion,
): StoredExtensionSourceMetadata {
  return {
    registryId: resolved.registry.source.id,
    manifestUrl: resolved.registry.source.manifestUrl,
    downloadUrl: resolved.version.downloadUrl,
    checksum: resolved.version.checksum.value,
    signature: resolved.version.signature,
    version: resolved.version.version,
  };
}

/**
 * Build update details from resolved extension version
 */
export function buildUpdateDetails(
  resolved: ResolvedExtensionVersion,
): StoredExtensionUpdateDetails {
  return {
    version: resolved.version.version,
    downloadUrl: resolved.version.downloadUrl,
    checksum: resolved.version.checksum.value,
    releaseNotes: resolved.version.releaseNotes,
    publishedAt: resolved.version.publishedAt,
    manifestUrl: resolved.registry.source.manifestUrl,
    minHostVersion: resolved.version.minHostVersion,
    minSdkVersion: resolved.version.minSdkVersion,
    compatibilityNotes: resolved.version.compatibilityNotes,
    signature: resolved.version.signature,
    registryId: resolved.registry.source.id,
  };
}
