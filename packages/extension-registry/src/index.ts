import { compare, valid } from "semver";

export type ChecksumAlgorithm = "sha256";

export interface ExtensionArtifactChecksum {
  algorithm: ChecksumAlgorithm;
  value: string;
}

export interface ExtensionArtifactSignature {
  algorithm: "pgp" | "minisign" | "rsa" | "ed25519";
  value: string;
}

export interface ExtensionRegistryVersion {
  version: string;
  downloadUrl: string;
  checksum: ExtensionArtifactChecksum;
  releaseNotes: string;
  publishedAt?: string;
  minHostVersion?: string;
  minSdkVersion?: string;
  compatibilityNotes?: string;
  signature?: ExtensionArtifactSignature;
  metadata?: Record<string, unknown>;
  deprecated?: boolean;
}

export interface ExtensionRegistryPublisher {
  name: string;
  url?: string;
  contact?: string;
}

export interface ExtensionRegistryExtension {
  id: string;
  name: string;
  summary: string;
  description?: string;
  homepage?: string;
  repository?: string;
  icon?: string;
  tags?: string[];
  categories?: string[];
  license?: string;
  author: ExtensionRegistryPublisher;
  maintainers?: ExtensionRegistryPublisher[];
  versions: ExtensionRegistryVersion[];
}

export interface ExtensionRegistryMetadata {
  id: string;
  name: string;
  description?: string;
  homepage?: string;
  supportUrl?: string;
  icon?: string;
  maintainers?: ExtensionRegistryPublisher[];
}

export interface ExtensionRegistryManifest {
  registry: ExtensionRegistryMetadata;
  generatedAt?: string;
  extensions: ExtensionRegistryExtension[];
}

export interface RegistryValidationResult {
  valid: boolean;
  errors: string[];
  manifest?: ExtensionRegistryManifest;
}

export interface LatestVersionOptions {
  includeDeprecated?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateChecksum(
  basePath: string,
  value: unknown,
  errors: string[],
): ExtensionArtifactChecksum | undefined {
  if (!isRecord(value)) {
    errors.push(`${basePath} must be an object.`);
    return undefined;
  }

  if (!isNonEmptyString(value.algorithm)) {
    errors.push(`${basePath}.algorithm is required.`);
    return undefined;
  }

  const algorithm = value.algorithm;
  if (algorithm !== "sha256") {
    errors.push(`${basePath}.algorithm must be \"sha256\".`);
    return undefined;
  }

  if (!isNonEmptyString(value.value)) {
    errors.push(`${basePath}.value is required.`);
    return undefined;
  }

  if (!/^[a-fA-F0-9]{64}$/.test(value.value)) {
    errors.push(`${basePath}.value must be a 64 character hex string.`);
    return undefined;
  }

  return { algorithm: "sha256", value: value.value.toLowerCase() };
}

function validateSignature(
  basePath: string,
  value: unknown,
  errors: string[],
): ExtensionArtifactSignature | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    errors.push(`${basePath} must be an object when provided.`);
    return undefined;
  }

  if (!isNonEmptyString(value.algorithm)) {
    errors.push(`${basePath}.algorithm is required.`);
    return undefined;
  }

  const algorithm = value.algorithm;
  if (
    algorithm !== "pgp" &&
    algorithm !== "minisign" &&
    algorithm !== "rsa" &&
    algorithm !== "ed25519"
  ) {
    errors.push(
      `${basePath}.algorithm must be pgp, minisign, rsa, or ed25519.`,
    );
    return undefined;
  }

  if (!isNonEmptyString(value.value)) {
    errors.push(`${basePath}.value is required.`);
    return undefined;
  }

  return { algorithm, value: value.value };
}

function validatePublisher(
  basePath: string,
  value: unknown,
  errors: string[],
): ExtensionRegistryPublisher | undefined {
  if (!isRecord(value)) {
    errors.push(`${basePath} must be an object.`);
    return undefined;
  }

  if (!isNonEmptyString(value.name)) {
    errors.push(`${basePath}.name is required.`);
    return undefined;
  }

  const publisher: ExtensionRegistryPublisher = {
    name: value.name.trim(),
  };

  if (value.url !== undefined) {
    if (!isNonEmptyString(value.url)) {
      errors.push(`${basePath}.url must be a non-empty string when provided.`);
    } else {
      publisher.url = value.url.trim();
    }
  }

  if (value.contact !== undefined) {
    if (!isNonEmptyString(value.contact)) {
      errors.push(
        `${basePath}.contact must be a non-empty string when provided.`,
      );
    } else {
      publisher.contact = value.contact.trim();
    }
  }

  return publisher;
}

function validateVersion(
  basePath: string,
  value: unknown,
  errors: string[],
): ExtensionRegistryVersion | undefined {
  if (!isRecord(value)) {
    errors.push(`${basePath} must be an object.`);
    return undefined;
  }

  if (!isNonEmptyString(value.version)) {
    errors.push(`${basePath}.version is required.`);
    return undefined;
  }

  if (!valid(value.version)) {
    errors.push(`${basePath}.version must be a valid semantic version.`);
    return undefined;
  }

  if (!isNonEmptyString(value.downloadUrl)) {
    errors.push(`${basePath}.downloadUrl is required.`);
    return undefined;
  }

  const checksum = validateChecksum(
    `${basePath}.checksum`,
    value.checksum,
    errors,
  );

  const releaseNotes = isNonEmptyString(value.releaseNotes)
    ? value.releaseNotes.trim()
    : undefined;
  if (!releaseNotes) {
    errors.push(`${basePath}.releaseNotes is required.`);
  }

  if (value.publishedAt !== undefined) {
    if (!isNonEmptyString(value.publishedAt)) {
      errors.push(
        `${basePath}.publishedAt must be a non-empty string when provided.`,
      );
    } else {
      // assigned later once version is confirmed
    }
  }

  if (value.minHostVersion !== undefined) {
    if (
      !isNonEmptyString(value.minHostVersion) ||
      !valid(value.minHostVersion)
    ) {
      errors.push(
        `${basePath}.minHostVersion must be a semantic version when provided.`,
      );
    } else {
      // assigned later once version is confirmed
    }
  }

  if (value.minSdkVersion !== undefined) {
    if (!isNonEmptyString(value.minSdkVersion) || !valid(value.minSdkVersion)) {
      errors.push(
        `${basePath}.minSdkVersion must be a semantic version when provided.`,
      );
    } else {
      // assigned later once version is confirmed
    }
  }

  if (value.compatibilityNotes !== undefined) {
    if (!isNonEmptyString(value.compatibilityNotes)) {
      errors.push(
        `${basePath}.compatibilityNotes must be a non-empty string when provided.`,
      );
    } else {
      // assigned later once version is confirmed
    }
  }

  const signature = validateSignature(
    `${basePath}.signature`,
    value.signature,
    errors,
  );

  if (value.metadata !== undefined) {
    if (!isRecord(value.metadata)) {
      errors.push(`${basePath}.metadata must be an object when provided.`);
    } else {
      // assigned later once version is confirmed
    }
  }

  if (value.deprecated !== undefined) {
    if (typeof value.deprecated !== "boolean") {
      errors.push(`${basePath}.deprecated must be a boolean when provided.`);
    } else {
      // assigned later once version is confirmed
    }
  }

  if (!checksum || !releaseNotes) {
    return undefined;
  }

  const version: ExtensionRegistryVersion = {
    version: value.version,
    downloadUrl: value.downloadUrl.trim(),
    checksum,
    releaseNotes,
  };

  if (isNonEmptyString(value.publishedAt)) {
    version.publishedAt = value.publishedAt.trim();
  }

  if (isNonEmptyString(value.minHostVersion) && valid(value.minHostVersion)) {
    version.minHostVersion = value.minHostVersion;
  }

  if (isNonEmptyString(value.minSdkVersion) && valid(value.minSdkVersion)) {
    version.minSdkVersion = value.minSdkVersion;
  }

  if (isNonEmptyString(value.compatibilityNotes)) {
    version.compatibilityNotes = value.compatibilityNotes.trim();
  }

  if (signature) {
    version.signature = signature;
  }

  if (isRecord(value.metadata)) {
    version.metadata = value.metadata;
  }

  if (typeof value.deprecated === "boolean") {
    version.deprecated = value.deprecated;
  }

  return version;
}

function validateExtension(
  basePath: string,
  value: unknown,
  errors: string[],
): ExtensionRegistryExtension | undefined {
  if (!isRecord(value)) {
    errors.push(`${basePath} must be an object.`);
    return undefined;
  }

  if (!isNonEmptyString(value.id)) {
    errors.push(`${basePath}.id is required.`);
    return undefined;
  }

  const name = isNonEmptyString(value.name) ? value.name.trim() : undefined;
  if (!name) {
    errors.push(`${basePath}.name is required.`);
  }

  const summary = isNonEmptyString(value.summary)
    ? value.summary.trim()
    : undefined;
  if (!summary) {
    errors.push(`${basePath}.summary is required.`);
  }

  const author = validatePublisher(`${basePath}.author`, value.author, errors);

  const extension: ExtensionRegistryExtension = {
    id: value.id,
    name: name ?? "",
    summary: summary ?? "",
    author: author ?? { name: "" },
    versions: [],
  } as ExtensionRegistryExtension;

  if (author) {
    extension.author = author;
  }

  if (value.description !== undefined) {
    if (!isNonEmptyString(value.description)) {
      errors.push(
        `${basePath}.description must be a non-empty string when provided.`,
      );
    } else {
      extension.description = value.description;
    }
  }

  if (value.homepage !== undefined) {
    if (!isNonEmptyString(value.homepage)) {
      errors.push(
        `${basePath}.homepage must be a non-empty string when provided.`,
      );
    } else {
      extension.homepage = value.homepage;
    }
  }

  if (value.repository !== undefined) {
    if (!isNonEmptyString(value.repository)) {
      errors.push(
        `${basePath}.repository must be a non-empty string when provided.`,
      );
    } else {
      extension.repository = value.repository;
    }
  }

  if (value.icon !== undefined) {
    if (!isNonEmptyString(value.icon)) {
      errors.push(`${basePath}.icon must be a non-empty string when provided.`);
    } else {
      extension.icon = value.icon;
    }
  }

  if (value.tags !== undefined) {
    if (
      !Array.isArray(value.tags) ||
      value.tags.some((tag) => !isNonEmptyString(tag))
    ) {
      errors.push(
        `${basePath}.tags must be an array of non-empty strings when provided.`,
      );
    } else {
      extension.tags = value.tags.map((tag: unknown) => (tag as string).trim());
    }
  }

  if (value.categories !== undefined) {
    if (
      !Array.isArray(value.categories) ||
      value.categories.some((category) => !isNonEmptyString(category))
    ) {
      errors.push(
        `${basePath}.categories must be an array of non-empty strings when provided.`,
      );
    } else {
      extension.categories = value.categories.map((category: unknown) =>
        (category as string).trim(),
      );
    }
  }

  if (value.license !== undefined) {
    if (!isNonEmptyString(value.license)) {
      errors.push(
        `${basePath}.license must be a non-empty string when provided.`,
      );
    } else {
      extension.license = value.license;
    }
  }

  const maintainersValue = value.maintainers;
  if (maintainersValue !== undefined) {
    if (!Array.isArray(maintainersValue)) {
      errors.push(`${basePath}.maintainers must be an array when provided.`);
    } else {
      const maintainers: ExtensionRegistryPublisher[] = [];
      maintainersValue.forEach((entry, index) => {
        const publisher = validatePublisher(
          `${basePath}.maintainers[${index}]`,
          entry,
          errors,
        );
        if (publisher) maintainers.push(publisher);
      });
      extension.maintainers = maintainers;
    }
  }

  if (!Array.isArray(value.versions) || value.versions.length === 0) {
    errors.push(`${basePath}.versions must be a non-empty array.`);
    return undefined;
  }

  const versions: ExtensionRegistryVersion[] = [];
  value.versions.forEach((entry, index) => {
    const version = validateVersion(
      `${basePath}.versions[${index}]`,
      entry,
      errors,
    );
    if (version) versions.push(version);
  });

  if (versions.length === 0) {
    errors.push(
      `${basePath}.versions must contain at least one valid release.`,
    );
    return undefined;
  }

  extension.versions = versions;

  if (!name || !summary || !author) {
    return undefined;
  }

  return extension;
}

function validateManifestMetadata(
  value: unknown,
  errors: string[],
): ExtensionRegistryMetadata | undefined {
  if (!isRecord(value)) {
    errors.push("manifest.registry must be an object.");
    return undefined;
  }

  if (!isNonEmptyString(value.id)) {
    errors.push("manifest.registry.id is required.");
  }

  if (!isNonEmptyString(value.name)) {
    errors.push("manifest.registry.name is required.");
  }

  const metadata: ExtensionRegistryMetadata = {
    id: (value.id as string) ?? "",
    name: (value.name as string) ?? "",
  } as ExtensionRegistryMetadata;

  if (value.description !== undefined) {
    if (!isNonEmptyString(value.description)) {
      errors.push(
        "manifest.registry.description must be a non-empty string when provided.",
      );
    } else {
      metadata.description = value.description;
    }
  }

  if (value.homepage !== undefined) {
    if (!isNonEmptyString(value.homepage)) {
      errors.push(
        "manifest.registry.homepage must be a non-empty string when provided.",
      );
    } else {
      metadata.homepage = value.homepage;
    }
  }

  if (value.supportUrl !== undefined) {
    if (!isNonEmptyString(value.supportUrl)) {
      errors.push(
        "manifest.registry.supportUrl must be a non-empty string when provided.",
      );
    } else {
      metadata.supportUrl = value.supportUrl;
    }
  }

  if (value.icon !== undefined) {
    if (!isNonEmptyString(value.icon)) {
      errors.push(
        "manifest.registry.icon must be a non-empty string when provided.",
      );
    } else {
      metadata.icon = value.icon;
    }
  }

  const maintainers = value.maintainers;
  if (maintainers !== undefined) {
    if (!Array.isArray(maintainers)) {
      errors.push(
        "manifest.registry.maintainers must be an array when provided.",
      );
    } else {
      const parsed: ExtensionRegistryPublisher[] = [];
      maintainers.forEach((entry, index) => {
        const publisher = validatePublisher(
          `manifest.registry.maintainers[${index}]`,
          entry,
          errors,
        );
        if (publisher) parsed.push(publisher);
      });
      metadata.maintainers = parsed;
    }
  }

  return metadata;
}

export function validateRegistryManifest(
  input: unknown,
): RegistryValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: ["Manifest must be a JSON object."] };
  }

  const metadata = validateManifestMetadata(input.registry, errors);

  if (!Array.isArray(input.extensions)) {
    errors.push("manifest.extensions must be an array.");
  }

  const extensions: ExtensionRegistryExtension[] = [];
  if (Array.isArray(input.extensions)) {
    input.extensions.forEach((entry, index) => {
      const extension = validateExtension(
        `manifest.extensions[${index}]`,
        entry,
        errors,
      );
      if (extension) extensions.push(extension);
    });
  }

  if (input.generatedAt !== undefined) {
    if (!isNonEmptyString(input.generatedAt)) {
      errors.push(
        "manifest.generatedAt must be a non-empty string when provided.",
      );
    }
  }

  if (errors.length > 0 || !metadata) {
    return { valid: false, errors };
  }

  const manifest: ExtensionRegistryManifest = {
    registry: metadata,
    generatedAt: (input.generatedAt as string | undefined)?.trim() || undefined,
    extensions,
  };

  return { valid: true, errors: [], manifest };
}

export function getLatestVersion(
  extension: ExtensionRegistryExtension,
  options: LatestVersionOptions = {},
): ExtensionRegistryVersion | undefined {
  const includeDeprecated = options.includeDeprecated ?? false;
  const versions = includeDeprecated
    ? extension.versions
    : extension.versions.filter((version) => !version.deprecated);

  if (versions.length === 0) return undefined;

  return versions.slice().sort((a, b) => compare(b.version, a.version))[0];
}

export function findVersion(
  extension: ExtensionRegistryExtension,
  version: string,
): ExtensionRegistryVersion | undefined {
  return extension.versions.find((candidate) => candidate.version === version);
}

export function summarizeReleaseNotes(notes: string, limit = 280): string {
  if (notes.length <= limit) {
    return notes;
  }
  const truncated = notes.slice(0, limit - 1).trimEnd();
  return `${truncated}\u2026`;
}

export function compareVersions(a: string, b: string): number {
  return compare(a, b);
}

export function isValidVersion(version: string): boolean {
  return Boolean(valid(version));
}
