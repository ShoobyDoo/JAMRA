const catalogueItems = Array.from({ length: 5 }).map((_, index) => ({
    id: `example-${index + 1}`,
    title: `Example Series ${index + 1}`,
    description: "Sample description used for testing the ExtensionHost flow.",
    coverUrl: `https://picsum.photos/seed/example-${index + 1}/300/450`,
    status: "ongoing",
    tags: ["Action", "Adventure"],
    updatedAt: new Date(Date.now() - index * 86400000).toISOString(),
}));
const chapters = Array.from({ length: 3 }).map((_, index) => ({
    id: `chapter-${index + 1}`,
    title: `Chapter ${index + 1}`,
    number: `${index + 1}`,
    publishedAt: new Date(Date.now() - index * 43200000).toISOString(),
}));
const extension = {
    manifest: {
        id: "com.jamra.example",
        name: "Example Catalogue",
        version: "0.1.0",
        author: { name: "JAMRA" },
        languageCodes: ["en"],
        capabilities: {
            catalogue: true,
            mangaDetails: true,
            chapters: true,
            pages: true,
            search: true,
            settings: false,
        },
        description: "A mock extension that returns static data for verifying the host pipeline.",
    },
    handlers: {
        async catalogue(_context, request) {
            const pageSize = 5;
            const start = (request.page - 1) * pageSize;
            const items = catalogueItems.slice(start, start + pageSize);
            const response = {
                items,
                hasMore: start + pageSize < catalogueItems.length,
            };
            return response;
        },
        async search(context, request) {
            const query = request.query?.toLowerCase().trim();
            context.logger.info("Example search invoked", { query });
            const items = catalogueItems.filter((item) => query ? item.title.toLowerCase().includes(query) : true);
            return { items, hasMore: false };
        },
        async fetchMangaDetails(_context, request) {
            const summary = catalogueItems.find((item) => item.id === request.mangaId);
            if (!summary)
                throw new Error(`Unknown manga id: ${request.mangaId}`);
            const details = {
                ...summary,
                authors: ["Jane Doe"],
                artists: ["John Doe"],
                chapters,
                genres: ["Drama"],
                rating: 4.2,
                year: 2024,
                links: {
                    Website: "https://example.com",
                },
            };
            return details;
        },
        async fetchChapters(_context, request) {
            if (!catalogueItems.some((item) => item.id === request.mangaId)) {
                throw new Error(`Unknown manga id: ${request.mangaId}`);
            }
            return chapters;
        },
        async fetchChapterPages(_context, request) {
            return {
                mangaId: request.mangaId,
                chapterId: request.chapterId,
                pages: Array.from({ length: 3 }).map((_, index) => ({
                    index,
                    url: `https://picsum.photos/seed/${request.chapterId}-${index}/1080/1920`,
                    width: 1080,
                    height: 1920,
                })),
            };
        },
    },
};
export default extension;
