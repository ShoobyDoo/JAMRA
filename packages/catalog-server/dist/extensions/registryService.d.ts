import { ExtensionRegistryManifest, ExtensionRegistryExtension, ExtensionRegistryVersion } from "@jamra/extension-registry";
export interface RegistrySourceConfig {
    id?: string;
    url: string;
    label?: string;
    priority?: number;
}
export interface RegistrySource extends RegistrySourceConfig {
    id: string;
    manifestUrl: string;
}
export interface CachedRegistryManifest {
    source: RegistrySource;
    manifest: ExtensionRegistryManifest;
    fetchedAt: number;
}
export interface MarketplaceExtensionRecord {
    registry: RegistrySource;
    extension: ExtensionRegistryExtension;
    latestVersion?: ExtensionRegistryVersion;
}
export interface ResolveExtensionOptions {
    version?: string;
    includeDeprecated?: boolean;
}
export interface ResolvedExtensionVersion {
    registry: CachedRegistryManifest;
    extension: ExtensionRegistryExtension;
    version: ExtensionRegistryVersion;
}
export interface DownloadedExtensionAsset {
    filePath: string;
    cleanup: () => Promise<void>;
}
interface ExtensionRegistryServiceOptions {
    refreshIntervalMs?: number;
    fetchImpl?: typeof fetch;
    onError?: (error: unknown, source: RegistrySourceConfig) => void;
}
export declare class ExtensionRegistryService {
    private readonly sources;
    private readonly refreshIntervalMs;
    private readonly fetch;
    private readonly onError?;
    private readonly cacheByUrl;
    private readonly cacheById;
    private readonly inflight;
    constructor(sources: RegistrySourceConfig[], options?: ExtensionRegistryServiceOptions);
    listRegistries(force?: boolean): Promise<CachedRegistryManifest[]>;
    listMarketplaceExtensions(force?: boolean): Promise<MarketplaceExtensionRecord[]>;
    resolveExtension(registryId: string, extensionId: string, options?: ResolveExtensionOptions): Promise<ResolvedExtensionVersion | undefined>;
    refreshRegistry(registryId: string): Promise<CachedRegistryManifest | undefined>;
    downloadVersionAsset(resolved: ResolvedExtensionVersion): Promise<DownloadedExtensionAsset>;
    private ensureRegistryById;
    private loadSource;
    private fetchManifestFromSource;
    private resolveFilePath;
    private deriveExtensionFromUrl;
    private isExpired;
    private handleError;
}
export {};
//# sourceMappingURL=registryService.d.ts.map