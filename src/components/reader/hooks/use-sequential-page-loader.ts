import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchChapterPages } from "@/lib/api";

export interface PageImage {
  index: number;
  url: string;
  width?: number;
  height?: number;
}

export interface SequentialPageLoaderConfig {
  /** Number of pages to load immediately on mount */
  initialPageCount: number;
  /** Number of pages to load in each subsequent chunk */
  chunkSize: number;
  /** Whether to preload images in browser cache */
  enableImagePreload: boolean;
}

export interface SequentialPageLoaderResult {
  /** Array of loaded pages (null = not loaded yet) */
  pages: Array<PageImage | null>;
  /** Total number of pages in chapter */
  totalPages: number;
  /** Whether initial pages are loading */
  isLoading: boolean;
  /** Current loading progress (0-100) */
  loadingProgress: number;
  /** Error if loading failed */
  error: Error | null;
  /** Retry loading from current position */
  retry: () => Promise<void>;
  /** Force load a specific page immediately */
  loadPage: (index: number) => Promise<void>;
}

const DEFAULT_CONFIG: SequentialPageLoaderConfig = {
  initialPageCount: 3,
  chunkSize: 5,
  enableImagePreload: true,
};

/**
 * Hook to sequentially load chapter pages with configurable chunking.
 *
 * Loading Strategy:
 * 1. Immediately load first `initialPageCount` pages (default 3)
 * 2. Sequentially load remaining pages in chunks of `chunkSize` (default 5)
 * 3. Each chunk waits for previous chunk to complete before starting
 * 4. Optionally preload images in browser cache as they're fetched
 */
export function useSequentialPageLoader(
  mangaId: string,
  chapterId: string,
  extensionId: string | undefined,
  config: Partial<SequentialPageLoaderConfig> = {},
): SequentialPageLoaderResult {
  const finalConfig = useMemo(() => {
    return {
      initialPageCount:
        config.initialPageCount ?? DEFAULT_CONFIG.initialPageCount,
      chunkSize: config.chunkSize ?? DEFAULT_CONFIG.chunkSize,
      enableImagePreload:
        config.enableImagePreload ?? DEFAULT_CONFIG.enableImagePreload,
    };
  }, [config.initialPageCount, config.chunkSize, config.enableImagePreload]);

  const [pages, setPages] = useState<Array<PageImage | null>>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  // Refs to manage loading state
  const allPagesRef = useRef<Array<PageImage | null>>([]);
  const loadedIndicesRef = useRef<Set<number>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const imagePreloadCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Preload an image in the browser
  const preloadImage = useCallback(
    (url: string): Promise<void> => {
      if (!finalConfig.enableImagePreload) {
        return Promise.resolve();
      }

      if (imagePreloadCache.current.has(url)) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          imagePreloadCache.current.set(url, img);
          resolve();
        };
        img.onerror = () => {
          // Don't fail on preload errors, just resolve
          resolve();
        };
        img.src = url;
      });
    },
    [finalConfig.enableImagePreload],
  );

  // Update pages state from ref
  const updatePagesState = useCallback(() => {
    setPages([...allPagesRef.current]);
    const loaded = loadedIndicesRef.current.size;
    const total = allPagesRef.current.length;
    if (total > 0) {
      setLoadingProgress(Math.round((loaded / total) * 100));
    }
  }, []);

  // Load all pages from API
  const loadAllPages = useCallback(async (): Promise<PageImage[]> => {
    const response = await fetchChapterPages(mangaId, chapterId, extensionId);
    return response.pages.pages.map((page) => ({
      index: page.index,
      url: page.url,
      width: page.width,
      height: page.height,
    }));
  }, [mangaId, chapterId, extensionId]);

  // Process pages in chunks after fetching
  const processChunks = useCallback(
    async (allPages: PageImage[]): Promise<void> => {
      const { initialPageCount, chunkSize } = finalConfig;

      // Process initial pages first
      const initialEnd = Math.min(initialPageCount, allPages.length);
      for (let i = 0; i < initialEnd; i++) {
        if (abortControllerRef.current?.signal.aborted) return;

        allPagesRef.current[i] = allPages[i];
        loadedIndicesRef.current.add(i);
        await preloadImage(allPages[i].url);
      }
      updatePagesState();

      // Process remaining pages in chunks
      let currentIndex = initialEnd;
      while (currentIndex < allPages.length) {
        if (abortControllerRef.current?.signal.aborted) return;

        const chunkEnd = Math.min(currentIndex + chunkSize, allPages.length);

        // Load chunk pages
        for (let i = currentIndex; i < chunkEnd; i++) {
          if (abortControllerRef.current?.signal.aborted) return;

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

  // Main loading function
  const startLoading = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress(0);

    // Reset state
    allPagesRef.current = [];
    loadedIndicesRef.current.clear();
    imagePreloadCache.current.clear();

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      // Fetch all pages from API
      const allPages = await loadAllPages();

      // Initialize pages array with nulls
      allPagesRef.current = Array.from({ length: allPages.length }, () => null);
      setTotalPages(allPages.length);
      updatePagesState();

      // Process pages in chunks
      await processChunks(allPages);

      setIsLoading(false);
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        return; // Don't set error if intentionally aborted
      }

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsLoading(false);
    }
  }, [loadAllPages, processChunks, updatePagesState]);

  // Load a specific page immediately
  const loadPage = useCallback(
    async (index: number): Promise<void> => {
      if (index < 0 || index >= allPagesRef.current.length) {
        return;
      }

      if (loadedIndicesRef.current.has(index)) {
        return;
      }

      // If page exists in array but not marked as loaded, preload it
      const page = allPagesRef.current[index];
      if (page) {
        await preloadImage(page.url);
        loadedIndicesRef.current.add(index);
        updatePagesState();
      }
    },
    [preloadImage, updatePagesState],
  );

  // Retry loading
  const retry = useCallback(async (): Promise<void> => {
    await startLoading();
  }, [startLoading]);

  // Start loading on mount or when dependencies change
  useEffect(() => {
    startLoading();

    return () => {
      // Abort on unmount
      abortControllerRef.current?.abort();
    };
  }, [startLoading]);

  return {
    pages,
    totalPages,
    isLoading,
    loadingProgress,
    error,
    retry,
    loadPage,
  };
}
