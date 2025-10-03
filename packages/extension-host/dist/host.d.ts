import type { CatalogueRequest, CatalogueResponse, ChapterListRequest, ChapterPages, ChapterPagesRequest, ExtensionContext, ExtensionHandlers, ExtensionManifest, ExtensionSettingsSchema, ExtensionFilters, MangaDetails, MangaDetailsRequest } from "@jamra/extension-sdk";
import { type CatalogDatabase, type StoredExtensionSourceMetadata, type StoredExtensionUpdateState } from "@jamra/catalog-db";
import { type CreateExtensionContextOptions } from "./context/index.js";
export interface ExtensionHostOptions {
    defaultContext?: CreateExtensionContextOptions;
    database?: CatalogDatabase;
    cacheFactory?: (manifest: ExtensionManifest) => ExtensionContext["cache"];
}
export interface LoadExtensionOptions {
    context?: CreateExtensionContextOptions;
    settings?: Record<string, unknown>;
    sourceMetadata?: StoredExtensionSourceMetadata | null;
    updateState?: StoredExtensionUpdateState | null;
}
export interface ExtensionInvocationOptions {
    settings?: Record<string, unknown>;
    contextOverrides?: Partial<Pick<ExtensionContext, "logger" | "cache" | "http" | "runtime" | "settings">>;
}
export declare class ExtensionHost {
    private readonly options;
    private readonly extensions;
    private readonly repository?;
    private readonly cacheFactory?;
    private readonly defaultContext?;
    private sharedCache?;
    constructor(options?: ExtensionHostOptions);
    loadFromFile(filePath: string, options?: LoadExtensionOptions): Promise<{
        manifest: ExtensionManifest;
        filePath: string;
    }>;
    private resolveCache;
    listManifests(): ExtensionManifest[];
    getManifest(id: string): ExtensionManifest | undefined;
    getHandlers(id: string): ExtensionHandlers | undefined;
    listLoadedExtensions(): Array<{
        id: string;
        manifest: ExtensionManifest;
        filePath: string;
    }>;
    isLoaded(id: string): boolean;
    getBaseSettings(id: string): Record<string, unknown> | undefined;
    disableExtension(id: string): Promise<void>;
    updateExtensionSettings(id: string, settings: Record<string, unknown> | null): Promise<void>;
    unload(id: string): Promise<void>;
    private ensureExtension;
    invokeCatalogue(id: string, request: CatalogueRequest, options?: ExtensionInvocationOptions): Promise<CatalogueResponse>;
    invokeSearch(id: string, request: CatalogueRequest, options?: ExtensionInvocationOptions): Promise<CatalogueResponse>;
    invokeMangaDetails(id: string, request: MangaDetailsRequest, options?: ExtensionInvocationOptions): Promise<MangaDetails>;
    invokeChapterList(id: string, request: ChapterListRequest, options?: ExtensionInvocationOptions): Promise<MangaDetails["chapters"]>;
    invokeChapterPages(id: string, request: ChapterPagesRequest, options?: ExtensionInvocationOptions): Promise<ChapterPages>;
    getFilters(id: string, options?: ExtensionInvocationOptions): Promise<ExtensionFilters | undefined>;
    getSettingsSchema(id: string, options?: ExtensionInvocationOptions): Promise<ExtensionSettingsSchema | undefined>;
}
//# sourceMappingURL=host.d.ts.map