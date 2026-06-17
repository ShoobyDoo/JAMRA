import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../../../api/client";
import { API_BASE_URL, API_PATHS } from "../../../constants/api";
import type { ReaderChapter, ReaderChapterSummary } from "../../../types";

export interface PageImage {
  index: number;
  url: string;
  width?: number;
  height?: number;
}

export interface ChapterMeta {
  id: string;
  title?: string;
  number?: string;
  previousChapterId: string | null;
  nextChapterId: string | null;
  isDownloaded: boolean;
  chapters: ReaderChapterSummary[];
}

export interface SequentialPageLoaderConfig {
  initialPageCount: number;
  chunkSize: number;
  enableImagePreload: boolean;
}

export interface SequentialPageLoaderResult {
  pages: Array<PageImage | null>;
  totalPages: number;
  isLoading: boolean;
  loadingProgress: number;
  error: Error | null;
  chapterMeta: ChapterMeta | null;
  retry: () => Promise<void>;
  loadPage: (index: number) => Promise<void>;
}

const DEFAULT_CONFIG: SequentialPageLoaderConfig = {
  initialPageCount: 3,
  chunkSize: 5,
  enableImagePreload: true,
};

const buildImageSrc = (url: string): string => {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const base = API_BASE_URL.endsWith("/")
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
};

export const useSequentialPageLoader = (
  libraryId: string,
  chapterId: string,
  config: Partial<SequentialPageLoaderConfig> = {},
): SequentialPageLoaderResult => {
  const finalConfig = useMemo(
    () => ({
      initialPageCount:
        config.initialPageCount ?? DEFAULT_CONFIG.initialPageCount,
      chunkSize: config.chunkSize ?? DEFAULT_CONFIG.chunkSize,
      enableImagePreload:
        config.enableImagePreload ?? DEFAULT_CONFIG.enableImagePreload,
    }),
    [config.initialPageCount, config.chunkSize, config.enableImagePreload],
  );

  const [pages, setPages] = useState<Array<PageImage | null>>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [chapterMeta, setChapterMeta] = useState<ChapterMeta | null>(null);

  const allPagesRef = useRef<Array<PageImage | null>>([]);
  const loadedIndicesRef = useRef<Set<number>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const imagePreloadCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const preloadImage = useCallback(
    (url: string): Promise<void> => {
      if (!finalConfig.enableImagePreload) return Promise.resolve();
      if (imagePreloadCache.current.has(url)) return Promise.resolve();

      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          imagePreloadCache.current.set(url, img);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });
    },
    [finalConfig.enableImagePreload],
  );

  const updatePagesState = useCallback(() => {
    setPages([...allPagesRef.current]);
    const loaded = loadedIndicesRef.current.size;
    const total = allPagesRef.current.length;
    if (total > 0) {
      setLoadingProgress(Math.round((loaded / total) * 100));
    }
  }, []);

  const loadAllPages = useCallback(
    async (
      signal: AbortSignal,
    ): Promise<{ pages: PageImage[]; meta: ChapterMeta }> => {
      const chapter = await apiClient.get<ReaderChapter>(
        API_PATHS.readerChapter(libraryId, chapterId),
        { signal },
      );
      const meta: ChapterMeta = {
        id: chapterId,
        title: chapter.title,
        number: chapter.number,
        previousChapterId: chapter.previousChapterId ?? null,
        nextChapterId: chapter.nextChapterId ?? null,
        isDownloaded: chapter.isDownloaded,
        chapters: chapter.chapters ?? [],
      };
      const pages = chapter.pages.map((page, i) => ({
        index: i,
        url: buildImageSrc(page.url),
      }));
      return { pages, meta };
    },
    [libraryId, chapterId],
  );

  const processChunks = useCallback(
    async (allPages: PageImage[], signal: AbortSignal): Promise<void> => {
      const { initialPageCount, chunkSize } = finalConfig;

      const initialEnd = Math.min(initialPageCount, allPages.length);
      for (let i = 0; i < initialEnd; i++) {
        if (signal.aborted) return;
        allPagesRef.current[i] = allPages[i];
        loadedIndicesRef.current.add(i);
        await preloadImage(allPages[i].url);
      }
      updatePagesState();

      let currentIndex = initialEnd;
      while (currentIndex < allPages.length) {
        if (signal.aborted) return;

        const chunkEnd = Math.min(currentIndex + chunkSize, allPages.length);
        for (let i = currentIndex; i < chunkEnd; i++) {
          if (signal.aborted) return;
          allPagesRef.current[i] = allPages[i];
          loadedIndicesRef.current.add(i);
          await preloadImage(allPages[i].url);
        }
        updatePagesState();
        currentIndex = chunkEnd;
      }
    },
    [finalConfig, preloadImage, updatePagesState],
  );

  const startLoading = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress(0);
    setChapterMeta(null);

    allPagesRef.current = [];
    loadedIndicesRef.current.clear();
    imagePreloadCache.current.clear();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { pages: allPages, meta } = await loadAllPages(controller.signal);

      setChapterMeta(meta);
      allPagesRef.current = Array.from({ length: allPages.length }, () => null);
      setTotalPages(allPages.length);
      updatePagesState();

      await processChunks(allPages, controller.signal);
      setIsLoading(false);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }
  }, [loadAllPages, processChunks, updatePagesState]);

  const retry = useCallback(async (): Promise<void> => {
    abortControllerRef.current?.abort();
    await startLoading();
  }, [startLoading]);

  const loadPage = useCallback(async (index: number): Promise<void> => {
    if (allPagesRef.current[index] !== null) return;
    // The full pages list is already in the loading pipeline.
    // This is a no-op safety guard; startLoading handles all pages.
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: data-fetching effect that resets loading state
    void startLoading();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [startLoading]);

  return {
    pages,
    totalPages,
    isLoading,
    loadingProgress,
    error,
    chapterMeta,
    retry,
    loadPage,
  };
};
