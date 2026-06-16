/**
 * MSW Request Handlers
 * Replicates backend API responses for testing
 */

import { http, HttpResponse } from "msw";
import { API_PATHS } from "../../constants/api";
import {
  mockSettings,
  mockExtensions,
  mockCatalog,
  mockLibraryItems,
  mockLibraryStats,
  mockDownloads,
  mockDownloadStats,
  mockSearchResults,
  mockMangaDetails,
  mockChapters,
  mockReaderChapterData,
  mockReadingProgress,
  mockInstallerJob,
} from "./data";

const BASE_URL = "http://localhost:3000";

export const handlers = [
  // Health check
  http.get(`${BASE_URL}${API_PATHS.health}`, () => {
    return HttpResponse.json({ status: "ok", timestamp: new Date().toISOString() });
  }),

  // Settings endpoints
  http.get(`${BASE_URL}${API_PATHS.settings}`, ({ request }) => {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");

    const filtered = scope
      ? mockSettings.filter((s) => s.scope === scope)
      : mockSettings;

    return HttpResponse.json({ settings: filtered });
  }),

  http.get(`${BASE_URL}/api/settings/:key`, ({ params }) => {
    const { key } = params;
    const setting = mockSettings.find((s) => s.key === key);

    if (!setting) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(setting);
  }),

  http.put(`${BASE_URL}${API_PATHS.settings}`, async ({ request }) => {
    const _body = (await request.json()) as { key: string; value: unknown; scope?: string };

    // Return 204 No Content like the real backend
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${BASE_URL}/api/settings/:key`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Catalog endpoints
  http.get(`${BASE_URL}${API_PATHS.catalog}`, ({ request }) => {
    const url = new URL(request.url);
    const repo = url.searchParams.get("repo");

    const filtered = repo
      ? mockCatalog.filter((c) => c.id === repo || c.slug === repo)
      : mockCatalog;

    return HttpResponse.json({ catalog: filtered });
  }),

  http.post(`${BASE_URL}${API_PATHS.catalogSync}`, () => {
    return HttpResponse.json({
      synced: mockCatalog.length,
      catalog: mockCatalog,
    });
  }),

  // Extensions endpoints
  http.get(`${BASE_URL}${API_PATHS.extensions}`, () => {
    return HttpResponse.json({ extensions: mockExtensions });
  }),

  http.get(`${BASE_URL}/api/extensions/:extensionId`, ({ params }) => {
    const { extensionId } = params;
    const extension = mockExtensions.find((e) => e.id === extensionId);

    if (!extension) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json({ extension });
  }),

  http.get(`${BASE_URL}/api/extensions/:extensionId/search`, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") || "";

    const filtered = mockSearchResults.filter((r) =>
      r.title.toLowerCase().includes(query.toLowerCase()),
    );

    return HttpResponse.json({
      results: filtered,
      hasMore: false,
      totalResults: filtered.length,
    });
  }),

  http.get(
    `${BASE_URL}/api/extensions/:extensionId/manga/:mangaId`,
    ({ params }) => {
      const { mangaId } = params;

      if (mangaId === "manga-1") {
        return HttpResponse.json(mockMangaDetails);
      }

      return new HttpResponse(null, { status: 404 });
    },
  ),

  http.get(
    `${BASE_URL}/api/extensions/:extensionId/manga/:mangaId/chapters`,
    () => {
      return HttpResponse.json({ chapters: mockChapters });
    },
  ),

  // Installer endpoints
  http.post(`${BASE_URL}${API_PATHS.installer}`, async ({ request }) => {
    const _body = (await request.json()) as {
      repositoryUrl: string;
      branch?: string;
      extensionIds?: string[];
    };

    return HttpResponse.json({
      jobId: "job-123",
      jobs: [mockInstallerJob],
    });
  }),

  http.get(`${BASE_URL}/api/installer/install/:jobId`, ({ params }) => {
    const { jobId } = params;

    if (jobId === "job-123") {
      return HttpResponse.json(mockInstallerJob);
    }

    return new HttpResponse(null, { status: 404 });
  }),

  // Library endpoints
  http.get(`${BASE_URL}${API_PATHS.library}`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const favorite = url.searchParams.get("favorite");
    const search = url.searchParams.get("search");

    let filtered = [...mockLibraryItems];

    if (status) {
      filtered = filtered.filter((item) => item.status === status);
    }

    if (favorite === "true") {
      filtered = filtered.filter((item) => item.favorite);
    }

    if (search) {
      filtered = filtered.filter((item) =>
        item.title.toLowerCase().includes(search.toLowerCase()),
      );
    }

    return HttpResponse.json({
      items: filtered,
      total: filtered.length,
    });
  }),

  http.get(`${BASE_URL}${API_PATHS.libraryStats}`, () => {
    return HttpResponse.json(mockLibraryStats);
  }),

  http.get(`${BASE_URL}/api/library/:libraryId`, ({ params }) => {
    const { libraryId } = params;
    const item = mockLibraryItems.find((i) => i.id === libraryId);

    if (!item) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(item);
  }),

  http.post(`${BASE_URL}${API_PATHS.library}`, async ({ request }) => {
    const body = (await request.json()) as {
      extensionId: string;
      mangaId: string;
      status?: string;
    };

    return HttpResponse.json({
      id: "lib-new",
      extensionId: body.extensionId,
      mangaId: body.mangaId,
      status: body.status || "planToRead",
      favorite: false,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: "New Manga",
      coverUrl: null,
      description: null,
      authors: [],
      tags: [],
      totalChapters: 0,
    }, { status: 201 });
  }),

  http.patch(`${BASE_URL}/api/library/:libraryId`, async ({ request, params }) => {
    const { libraryId } = params;
    const body = (await request.json()) as { status?: string };
    const item = mockLibraryItems.find((i) => i.id === libraryId);

    if (!item) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json({
      ...item,
      status: body.status || item.status,
      updatedAt: new Date().toISOString(),
    });
  }),

  http.patch(`${BASE_URL}/api/library/:libraryId/favorite`, async ({ request, params }) => {
    const { libraryId } = params;
    const body = (await request.json()) as { favorite: boolean };
    const item = mockLibraryItems.find((i) => i.id === libraryId);

    if (!item) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json({
      ...item,
      favorite: body.favorite,
      updatedAt: new Date().toISOString(),
    });
  }),

  http.delete(`${BASE_URL}/api/library/:libraryId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE_URL}/api/library/:libraryId/progress`, () => {
    return HttpResponse.json({ progress: mockReadingProgress });
  }),

  http.get(`${BASE_URL}/api/library/:libraryId/last-read`, () => {
    return HttpResponse.json(mockReadingProgress[0] || null);
  }),

  // Downloads endpoints
  http.get(`${BASE_URL}${API_PATHS.downloads}`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const filtered = status
      ? mockDownloads.filter((d) => d.status === status)
      : mockDownloads;

    return HttpResponse.json({ downloads: filtered });
  }),

  http.get(`${BASE_URL}${API_PATHS.downloadStats}`, () => {
    return HttpResponse.json(mockDownloadStats);
  }),

  http.get(`${BASE_URL}/api/downloads/:downloadId`, ({ params }) => {
    const { downloadId } = params;
    const download = mockDownloads.find((d) => d.id === downloadId);

    if (!download) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(download);
  }),

  http.post(`${BASE_URL}${API_PATHS.downloads}`, async ({ request }) => {
    const body = (await request.json()) as {
      libraryId: string;
      extensionId: string;
      chapterIds: string[];
    };

    return HttpResponse.json({
      queued: body.chapterIds.length,
      downloads: body.chapterIds.map((chapterId, index) => ({
        id: `dl-new-${index}`,
        libraryId: body.libraryId,
        extensionId: body.extensionId,
        chapterId,
        chapterNumber: String(index + 1),
        status: "pending",
        progress: 0,
        totalPages: 0,
        downloadedPages: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
        error: null,
      })),
    }, { status: 201 });
  }),

  http.delete(`${BASE_URL}/api/downloads/:downloadId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Reader endpoints
  http.get(`${BASE_URL}/api/reader/:libraryId/chapters/:chapterId`, ({ params }) => {
    const { chapterId } = params;

    if (chapterId === "ch-100") {
      return HttpResponse.json(mockReaderChapterData);
    }

    return new HttpResponse(null, { status: 404 });
  }),

  http.get(
    `${BASE_URL}/api/reader/:libraryId/chapters/:chapterId/next`,
    () => {
      return HttpResponse.json({ nextChapterId: "ch-101" });
    },
  ),

  http.get(
    `${BASE_URL}/api/reader/:libraryId/chapters/:chapterId/previous`,
    () => {
      return HttpResponse.json({ previousChapterId: "ch-99" });
    },
  ),

  http.get(
    `${BASE_URL}/api/reader/:libraryId/chapters/:chapterId/pages/:pageNumber`,
    () => {
      // Return a mock image response
      const buffer = new ArrayBuffer(100);
      return HttpResponse.arrayBuffer(buffer, {
        headers: {
          "Content-Type": "image/jpeg",
        },
      });
    },
  ),
];
