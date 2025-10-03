import type Database from "better-sqlite3";
import type { ChapterPages, ChapterSummary, ExtensionManifest, MangaDetails, MangaSummary } from "@jamra/extension-sdk";
import type { ExtensionArtifactSignature } from "@jamra/extension-registry";
export interface StoredExtensionSourceMetadata {
    registryId?: string;
    manifestUrl?: string;
    downloadUrl?: string;
    checksum?: string;
    signature?: ExtensionArtifactSignature;
    version?: string;
}
export interface StoredExtensionUpdateDetails {
    version: string;
    downloadUrl: string;
    checksum?: string;
    releaseNotes: string;
    publishedAt?: string;
    manifestUrl?: string;
    minHostVersion?: string;
    minSdkVersion?: string;
    compatibilityNotes?: string;
    signature?: ExtensionArtifactSignature;
    registryId?: string;
}
export interface StoredExtensionUpdateState {
    latest?: StoredExtensionUpdateDetails;
    lastCheckedAt?: number;
    acknowledgedVersion?: string;
    acknowledgedAt?: number;
}
export interface StoredExtension {
    id: string;
    name: string;
    version: string;
    description?: string;
    homepage?: string;
    icon?: string;
    author: {
        name: string;
        url?: string;
        contact?: string;
    };
    languageCodes: ExtensionManifest["languageCodes"];
    capabilities: ExtensionManifest["capabilities"];
    manifest: ExtensionManifest;
    installedAt: number;
    entryPath?: string;
    enabled: boolean;
    settings?: Record<string, unknown>;
    source?: StoredExtensionSourceMetadata;
    updateState?: StoredExtensionUpdateState;
}
export interface ExtensionListOptions {
    search?: string;
    status?: "enabled" | "disabled";
    sort?: "name" | "installedAt" | "author" | "language";
    order?: "asc" | "desc";
}
export interface UpsertExtensionOptions {
    entryPath?: string | null;
    enabled?: boolean;
    settings?: Record<string, unknown> | null;
    source?: StoredExtensionSourceMetadata | null;
    updateState?: StoredExtensionUpdateState | null;
}
export declare class CatalogRepository {
    private readonly db;
    constructor(db: Database.Database);
    upsertExtension(manifest: ExtensionManifest, options?: UpsertExtensionOptions): void;
    listExtensions(options?: ExtensionListOptions): StoredExtension[];
    getExtension(id: string): StoredExtension | undefined;
    setExtensionEnabled(id: string, enabled: boolean): void;
    removeExtension(id: string): void;
    updateExtensionSettings(id: string, settings: Record<string, unknown> | null): void;
    updateExtensionSourceMetadata(id: string, source: StoredExtensionSourceMetadata | null): void;
    updateExtensionUpdateState(id: string, state: StoredExtensionUpdateState | null): void;
    private getExtensionRow;
    private mapExtensionRow;
    updateSyncState(extensionId: string, partial: {
        catalogue?: number;
        full?: number;
    }): void;
    upsertMangaSummaries(extensionId: string, items: MangaSummary[]): void;
    upsertMangaDetails(extensionId: string, details: MangaDetails): void;
    upsertChapters(extensionId: string, mangaId: string, chapters: ChapterSummary[]): void;
    replaceChapterPages(extensionId: string, mangaId: string, payload: ChapterPages): void;
}
//# sourceMappingURL=catalogRepository.d.ts.map