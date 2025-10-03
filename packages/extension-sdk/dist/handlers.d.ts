import { CatalogueRequest, CatalogueResponse, ChapterListRequest, ChapterPages, ChapterPagesRequest, MangaDetails, MangaDetailsRequest, ExtensionFilters, ExtensionSettingsSchema } from "./types";
import { ExtensionContext } from "./context";
export type CatalogueHandler = (context: ExtensionContext, request: CatalogueRequest) => Promise<CatalogueResponse>;
export type MangaDetailsHandler = (context: ExtensionContext, request: MangaDetailsRequest) => Promise<MangaDetails>;
export type ChapterListHandler = (context: ExtensionContext, request: ChapterListRequest) => Promise<MangaDetails["chapters"]>;
export type ChapterPagesHandler = (context: ExtensionContext, request: ChapterPagesRequest) => Promise<ChapterPages>;
export type FiltersHandler = (context: ExtensionContext) => Promise<ExtensionFilters | undefined>;
export type SettingsSchemaResolver = (context: ExtensionContext) => Promise<ExtensionSettingsSchema | undefined>;
export interface ExtensionHandlers {
    onInitialize?(context: ExtensionContext): Promise<void> | void;
    onShutdown?(context: ExtensionContext): Promise<void> | void;
    getFilters?: FiltersHandler;
    getSettingsSchema?: SettingsSchemaResolver;
    catalogue?: CatalogueHandler;
    fetchMangaDetails?: MangaDetailsHandler;
    fetchChapters?: ChapterListHandler;
    fetchChapterPages?: ChapterPagesHandler;
    search?: CatalogueHandler;
}
//# sourceMappingURL=handlers.d.ts.map