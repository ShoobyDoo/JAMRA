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
export declare function validateRegistryManifest(input: unknown): RegistryValidationResult;
export declare function getLatestVersion(extension: ExtensionRegistryExtension, options?: LatestVersionOptions): ExtensionRegistryVersion | undefined;
export declare function findVersion(extension: ExtensionRegistryExtension, version: string): ExtensionRegistryVersion | undefined;
export declare function summarizeReleaseNotes(notes: string, limit?: number): string;
export declare function compareVersions(a: string, b: string): number;
export declare function isValidVersion(version: string): boolean;
//# sourceMappingURL=index.d.ts.map