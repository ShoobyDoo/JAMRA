import type {
  ExtensionCapabilities,
  ExtensionFilterCapabilities,
  ExtensionManifest,
  ExtensionSettingField,
  ExtensionSettingType,
  ExtensionSettingsSchema,
} from "../index.js";
import type { NormalizedSortField } from "./filter-normalizer.js";

const DEFAULT_ALLOWED_SETTING_TYPES: readonly ExtensionSettingType[] = [
  "string",
  "number",
  "boolean",
  "multi-select",
  "select",
];

const REQUIRED_MANIFEST_FIELDS: Array<keyof ExtensionManifest> = [
  "id",
  "name",
  "version",
  "language",
  "entry",
];

export interface DefineExtensionManifestOptions {
  allowedSettingTypes?: readonly ExtensionSettingType[];
  overrides?: Partial<ExtensionManifest>;
  transformField?: (
    field: ExtensionSettingField,
  ) => ExtensionSettingField | undefined;
}

export const defineExtensionManifest = (
  raw: unknown,
  options?: DefineExtensionManifestOptions,
): ExtensionManifest => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Extension manifest must be an object");
  }

  const manifest = { ...(raw as Record<string, unknown>) };
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (typeof manifest[field] !== "string" || !manifest[field]) {
      throw new Error(`Extension manifest requires a valid ${String(field)}`);
    }
  }

  const schema = normalizeSettingsSchema(
    manifest.settingsSchema,
    options?.allowedSettingTypes ?? DEFAULT_ALLOWED_SETTING_TYPES,
    options?.transformField,
  );

  const normalized: ExtensionManifest = {
    id: manifest.id as string,
    name: manifest.name as string,
    version: manifest.version as string,
    author: manifest.author as string | undefined,
    description: manifest.description as string | undefined,
    sourceUrl: manifest.sourceUrl as string | undefined,
    language: manifest.language as string,
    entry: manifest.entry as string,
    icon: manifest.icon as string | undefined,
    website: manifest.website as string | undefined,
    tags: Array.isArray(manifest.tags)
      ? Array.from(
          new Set(
            (manifest.tags as unknown[])
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        )
      : [],
    settingsSchema: schema,
    minAppVersion: manifest.minAppVersion as string | undefined,
    checksum: manifest.checksum as string | undefined,
    capabilities: normalizeCapabilities(manifest.capabilities),
  };

  if (options?.overrides) {
    Object.assign(normalized, options.overrides);
  }

  return normalized;
};

const normalizeCapabilities = (
  raw: unknown,
): ExtensionCapabilities | undefined => {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const filters = normalizeFilterCapabilities(
    (raw as Record<string, unknown>).filters,
  );
  if (!filters) {
    return undefined;
  }
  return { filters };
};

const normalizeFilterCapabilities = (
  raw: unknown,
): ExtensionFilterCapabilities | undefined => {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const result: ExtensionFilterCapabilities = {};
  const record = raw as Record<string, unknown>;
  if (typeof record.language === "boolean") {
    result.language = record.language;
  }
  if (typeof record.contentRating === "boolean") {
    result.contentRating = record.contentRating;
  }
  if (typeof record.status === "boolean") {
    result.status = record.status;
  }
  if (typeof record.includeTags === "boolean") {
    result.includeTags = record.includeTags;
  }
  if (typeof record.excludeTags === "boolean") {
    result.excludeTags = record.excludeTags;
  }
  if (Array.isArray(record.sort)) {
    const allowed = record.sort
      .filter((entry): entry is NormalizedSortField => typeof entry === "string")
      .filter((entry) => SORT_FIELDS.has(entry as NormalizedSortField));
    if (allowed.length > 0) {
      result.sort = Array.from(new Set(allowed));
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

const SORT_FIELDS = new Set<NormalizedSortField>([
  "relevance",
  "alphabetical",
  "updated",
  "created",
  "views",
  "subscriptions",
]);

const normalizeSettingsSchema = (
  raw: unknown,
  allowedTypes: readonly ExtensionSettingType[],
  transformField?: DefineExtensionManifestOptions["transformField"],
): ExtensionSettingsSchema | undefined => {
  if (!raw) {
    return undefined;
  }

  if (
    typeof raw !== "object" ||
    raw === null ||
    typeof (raw as Record<string, unknown>).version !== "number"
  ) {
    throw new Error("Extension settings schema must declare a numeric version");
  }

  const fieldsRaw = (raw as Record<string, unknown>).fields;
  if (!Array.isArray(fieldsRaw)) {
    throw new Error("Extension settings schema must contain a fields array");
  }

  const fields: ExtensionSettingField[] = [];
  for (const entry of fieldsRaw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const normalized = normalizeSettingField(
      entry as Record<string, unknown>,
      allowedTypes,
    );
    if (!normalized) {
      continue;
    }
    const transformed = transformField ? transformField(normalized) : normalized;
    if (transformed) {
      fields.push(transformed);
    }
  }

  return {
    version: (raw as { version: number }).version,
    fields,
  };
};

const normalizeSettingField = (
  field: Record<string, unknown>,
  allowedTypes: readonly ExtensionSettingType[],
): ExtensionSettingField | undefined => {
  const type = field.type;
  if (typeof type !== "string") {
    throw new Error("Extension setting field type must be a string");
  }
  if (!allowedTypes.includes(type as ExtensionSettingType)) {
    throw new Error(`Unsupported extension setting field type: ${type}`);
  }

  const key = field.key;
  const label = field.label;
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new Error("Extension setting field requires a key");
  }
  if (typeof label !== "string" || label.trim().length === 0) {
    throw new Error("Extension setting field requires a label");
  }

  const normalized: ExtensionSettingField = {
    key,
    label,
    description:
      typeof field.description === "string" ? field.description : undefined,
    type: type as ExtensionSettingType,
    default: field.default,
    required: typeof field.required === "boolean" ? field.required : undefined,
    options: normalizeSettingOptions(field.options),
  };

  return normalized;
};

const normalizeSettingOptions = (
  raw: unknown,
): ExtensionSettingField["options"] => {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return undefined;
      }
      const label = (entry as Record<string, unknown>).label;
      const value = (entry as Record<string, unknown>).value;
      if (typeof label !== "string" || typeof value !== "string") {
        return undefined;
      }
      return { label, value };
    })
    .filter(
      (
        option,
      ): option is NonNullable<ExtensionSettingField["options"]>[number] =>
        Boolean(option),
    );
};
