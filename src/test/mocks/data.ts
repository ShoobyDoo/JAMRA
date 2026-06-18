/**
 * Mock data for MSW handlers
 * Replicates backend response structures from docs/backend/endpoints.md
 */

import type {
  CatalogEntry,
  ChapterDetails,
  Download,
  DownloadStats,
  Extension,
  ExtensionSearchResult,
  InstallJob,
  LibraryItem,
  LibraryStats,
  MangaDetails,
  ReaderChapter,
  ReadingProgress,
  Setting,
} from "../../types";

export const mockSettings: Setting[] = [
  { key: "app.theme", value: "dark", scope: "app" },
  { key: "reader.pageFit", value: "fitWidth", scope: "reader" },
  { key: "downloads.quality", value: "high", scope: "downloads" },
];

export const mockExtensions: Extension[] = [
  {
    id: "batoto",
    slug: "batoto",
    name: "Batoto",
    version: "1.0.0",
    lang: ["en"],
    enabled: true,
    installedAt: "2025-01-10T12:00:00Z",
    sourcePath: "/extensions/batoto",
    repoUrl: "https://github.com/example/extensions",
    manifest: {
      id: "batoto",
      slug: "batoto",
      name: "Batoto",
      version: "1.0.0",
      lang: ["en"],
      thumbnail: null,
      description: "Popular manga aggregator",
      baseUrl: "https://batoto.to",
    },
  },
  {
    id: "mangadex",
    slug: "mangadex",
    name: "MangaDex",
    version: "1.0.0",
    lang: ["en"],
    enabled: true,
    installedAt: "2025-01-10T12:00:00Z",
    sourcePath: "/extensions/mangadex",
    repoUrl: "https://github.com/example/extensions",
    manifest: {
      id: "mangadex",
      slug: "mangadex",
      name: "MangaDex",
      version: "1.0.0",
      lang: ["en"],
      thumbnail: null,
      description: "MangaDex scanlation platform",
      baseUrl: "https://mangadex.org",
    },
  },
];

export const mockCatalog: CatalogEntry[] = [
  {
    id: "batoto",
    slug: "batoto",
    name: "Batoto",
    version: "1.0.0",
    lang: ["en"],
    thumbnail: null,
    description: "Popular manga aggregator",
    checksum: "abc123",
    lastSyncedAt: "2025-01-10T12:00:00Z",
  },
  {
    id: "mangadex",
    slug: "mangadex",
    name: "MangaDex",
    version: "1.0.0",
    lang: ["en"],
    thumbnail: null,
    description: "MangaDex scanlation platform",
    checksum: "def456",
    lastSyncedAt: "2025-01-10T12:00:00Z",
  },
];

export const mockLibraryItems: LibraryItem[] = [
  {
    id: "lib-1",
    extensionId: "batoto",
    mangaId: "manga-1",
    status: "reading",
    favorite: true,
    addedAt: "2025-01-10T12:00:00Z",
    updatedAt: "2025-01-12T14:30:00Z",
    title: "One Piece",
    coverUrl: "https://example.com/covers/one-piece.jpg",
    description: "A pirate adventure",
    authors: ["Eiichiro Oda"],
    tags: ["action", "adventure"],
    totalChapters: 1100,
  },
  {
    id: "lib-2",
    extensionId: "mangadex",
    mangaId: "manga-2",
    status: "completed",
    favorite: false,
    addedAt: "2025-01-09T10:00:00Z",
    updatedAt: "2025-01-11T16:00:00Z",
    title: "Naruto",
    coverUrl: "https://example.com/covers/naruto.jpg",
    description: "A ninja story",
    authors: ["Masashi Kishimoto"],
    tags: ["action", "ninja"],
    totalChapters: 700,
  },
];

export const mockLibraryStats: LibraryStats = {
  total: 25,
  reading: 12,
  completed: 8,
  planToRead: 3,
  onHold: 1,
  dropped: 1,
};

export const mockDownloads: Download[] = [
  {
    id: "dl-1",
    libraryId: "lib-1",
    extensionId: "batoto",
    chapterId: "ch-100",
    chapterNumber: "100",
    status: "completed",
    progress: 100,
    totalPages: 20,
    downloadedPages: 20,
    startedAt: "2025-01-12T10:00:00Z",
    completedAt: "2025-01-12T10:05:00Z",
    error: null,
  },
  {
    id: "dl-2",
    libraryId: "lib-1",
    extensionId: "batoto",
    chapterId: "ch-101",
    chapterNumber: "101",
    status: "downloading",
    progress: 50,
    totalPages: 18,
    downloadedPages: 9,
    startedAt: "2025-01-12T11:00:00Z",
    completedAt: null,
    error: null,
  },
];

export const mockDownloadStats: DownloadStats = {
  totalDownloads: 150,
  completedDownloads: 140,
  failedDownloads: 5,
  activeDownloads: 5,
  diskUsageBytes: 5368709120,
  diskUsageFormatted: "5.0 GB",
};

export const mockSearchResults: ExtensionSearchResult[] = [
  {
    id: "manga-1",
    title: "One Piece",
    coverUrl: "https://example.com/covers/one-piece.jpg",
    latestChapter: "1100",
    lang: "en",
  },
  {
    id: "manga-2",
    title: "Naruto",
    coverUrl: "https://example.com/covers/naruto.jpg",
    latestChapter: "700",
    lang: "en",
  },
];

export const mockMangaDetails: MangaDetails = {
  id: "manga-1",
  title: "One Piece",
  coverUrl: "https://example.com/covers/one-piece.jpg",
  description: "A pirate adventure",
  authors: ["Eiichiro Oda"],
  tags: ["action", "adventure"],
  status: "ongoing",
  lang: "en",
  chapters: [
    {
      id: "ch-100",
      title: "Chapter 100",
      number: "100",
      uploadedAt: "2025-01-10T12:00:00Z",
    },
    {
      id: "ch-101",
      title: "Chapter 101",
      number: "101",
      uploadedAt: "2025-01-11T12:00:00Z",
    },
  ],
};

export const mockChapters: ChapterDetails[] = [
  {
    id: "ch-100",
    title: "Chapter 100",
    number: "100",
    uploadedAt: "2025-01-10T12:00:00Z",
  },
  {
    id: "ch-101",
    title: "Chapter 101",
    number: "101",
    uploadedAt: "2025-01-11T12:00:00Z",
  },
];

export const mockReaderChapterData: ReaderChapter = {
  id: "ch-100",
  number: "100",
  title: "Chapter 100",
  pages: [
    { number: 1, url: "https://example.com/pages/1.jpg" },
    { number: 2, url: "https://example.com/pages/2.jpg" },
    { number: 3, url: "https://example.com/pages/3.jpg" },
  ],
  isDownloaded: false,
  nextChapterId: "ch-101",
  previousChapterId: "ch-99",
  chapters: [],
};

export const mockReadingProgress: ReadingProgress[] = [
  {
    id: "prog-1",
    libraryId: "lib-1",
    chapterId: "ch-100",
    chapterNumber: "100",
    pageNumber: 15,
    totalPages: 20,
    completedAt: null,
    updatedAt: "2025-01-12T14:30:00Z",
  },
];

export const mockInstallerJob: InstallJob = {
  jobId: "job-123",
  extensionId: "batoto",
  status: "completed",
  repositoryUrl: "https://github.com/example/extensions",
  requestedAt: Date.parse("2025-01-10T12:00:00Z"),
  completedAt: Date.parse("2025-01-10T12:05:00Z"),
  error: null,
};
