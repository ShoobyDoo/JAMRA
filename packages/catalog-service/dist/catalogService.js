import { CatalogRepository } from "@jamra/catalog-db";
export class CatalogService {
    constructor(host, options = {}) {
        this.host = host;
        if (options.repository) {
            this.repository = options.repository;
        }
        else if (options.database) {
            this.repository = new CatalogRepository(options.database.db);
        }
    }
    async fetchCataloguePage(extensionId, request) {
        const handler = request.query
            ? this.host.invokeSearch.bind(this.host)
            : this.host.invokeCatalogue.bind(this.host);
        const response = await handler(extensionId, request);
        if (this.repository && response.items.length > 0) {
            this.repository.upsertMangaSummaries(extensionId, response.items);
            this.repository.updateSyncState(extensionId, { catalogue: Date.now() });
        }
        return response;
    }
    async syncCatalogue(extensionId, options = {}) {
        const startPage = options.startPage ?? 1;
        const limit = options.pageLimit ?? Number.POSITIVE_INFINITY;
        let currentPage = startPage;
        let pagesFetched = 0;
        let itemsUpserted = 0;
        let hasMore = true;
        while (hasMore && pagesFetched < limit) {
            const response = await this.host.invokeCatalogue(extensionId, {
                page: currentPage,
                query: options.query,
                filters: options.filters,
            });
            if (response.items.length > 0) {
                this.repository?.upsertMangaSummaries(extensionId, response.items);
                itemsUpserted += response.items.length;
            }
            await options.onPage?.(response, currentPage);
            hasMore = response.hasMore;
            currentPage += 1;
            pagesFetched += 1;
        }
        this.repository?.updateSyncState(extensionId, { catalogue: Date.now() });
        return {
            pagesFetched,
            itemsUpserted,
            hasMore,
        };
    }
    async syncManga(extensionId, mangaId, options = {}) {
        const details = await this.host.invokeMangaDetails(extensionId, {
            mangaId,
        });
        this.repository?.upsertMangaDetails(extensionId, details);
        let chaptersFetched = 0;
        let chapters = details.chapters;
        if (options.includeChapters || !chapters || options.forceChapterRefresh) {
            chapters = await this.host.invokeChapterList(extensionId, { mangaId });
        }
        if (chapters && chapters.length > 0) {
            this.repository?.upsertChapters(extensionId, mangaId, chapters);
            chaptersFetched = chapters.length;
        }
        this.repository?.updateSyncState(extensionId, { full: Date.now() });
        return {
            details,
            chaptersFetched,
        };
    }
    async syncChapterPages(extensionId, mangaId, chapterId) {
        const pages = await this.host.invokeChapterPages(extensionId, {
            mangaId,
            chapterId,
        });
        this.repository?.replaceChapterPages(extensionId, mangaId, pages);
        return { pages };
    }
    async getFilters(extensionId) {
        return this.host.getFilters(extensionId);
    }
}
