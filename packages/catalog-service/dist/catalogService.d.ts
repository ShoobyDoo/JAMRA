import type { CatalogueRequest, CatalogueResponse, ChapterPages, ExtensionFilters, MangaDetails } from "@jamra/extension-sdk";
import { CatalogRepository, type CatalogDatabase } from "@jamra/catalog-db";
import { ExtensionHost } from "@jamra/extension-host";
export interface CatalogServiceOptions {
    repository?: CatalogRepository;
    database?: CatalogDatabase;
}
export interface CatalogueSyncOptions {
    startPage?: number;
    pageLimit?: number;
    query?: CatalogueRequest["query"];
    filters?: CatalogueRequest["filters"];
    onPage?: (page: CatalogueResponse, pageNumber: number) => Promise<void> | void;
}
export interface CatalogueSyncResult {
    pagesFetched: number;
    itemsUpserted: number;
    hasMore: boolean;
}
export interface MangaSyncOptions {
    includeChapters?: boolean;
    forceChapterRefresh?: boolean;
}
export interface MangaSyncResult {
    details: MangaDetails;
    chaptersFetched: number;
}
export interface ChapterPagesSyncResult {
    pages: ChapterPages;
}
export declare class CatalogService {
    private readonly host;
    private readonly repository?;
    constructor(host: ExtensionHost, options?: CatalogServiceOptions);
    fetchCataloguePage(extensionId: string, request: CatalogueRequest): Promise<CatalogueResponse>;
    syncCatalogue(extensionId: string, options?: CatalogueSyncOptions): Promise<CatalogueSyncResult>;
    syncManga(extensionId: string, mangaId: string, options?: MangaSyncOptions): Promise<MangaSyncResult>;
    syncChapterPages(extensionId: string, mangaId: string, chapterId: string): Promise<ChapterPagesSyncResult>;
    getFilters(extensionId: string): Promise<ExtensionFilters | undefined>;
}
//# sourceMappingURL=catalogService.d.ts.map