import { useEffect, useRef, useCallback } from "react";
import { useReaderSettings } from "@/store/reader-settings";
import { useReadingProgress } from "@/store/reading-progress";

export interface PageImage {
  index: number;
  url: string;
  width?: number;
  height?: number;
}

export function useChapterPagePreloader(
  pages: PageImage[],
  currentPageIndex: number,
  chapterId: string,
) {
  const { preloadCount } = useReaderSettings();
  const { addPreloadedImage, clearPreloadedImages } = useReadingProgress();
  const loadingImages = useRef<Set<string>>(new Set());
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const preloadImage = useCallback(
    (url: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (imageCache.current.has(url)) {
          addPreloadedImage(url);
          resolve();
          return;
        }

        if (loadingImages.current.has(url)) {
          resolve();
          return;
        }

        loadingImages.current.add(url);

        const img = new Image();

        img.onload = () => {
          imageCache.current.set(url, img);
          loadingImages.current.delete(url);
          addPreloadedImage(url);
          resolve();
        };

        img.onerror = () => {
          loadingImages.current.delete(url);
          reject(new Error(`Failed to load image: ${url}`));
        };

        img.src = url;
      });
    },
    [addPreloadedImage],
  );

  const preloadRange = useCallback(
    async (startIndex: number, count: number) => {
      const jobs: Promise<void>[] = [];

      for (let i = 0; i < count; i++) {
        const pageIndex = startIndex + i;
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          if (page?.url) {
            jobs.push(
              preloadImage(page.url).catch((error) => {
                console.warn(`Failed to preload page ${pageIndex}:`, error);
              }),
            );
          }
        }
      }

      await Promise.all(jobs);
    },
    [pages, preloadImage],
  );

  useEffect(() => {
    const loadImages = async () => {
      const current = pages[currentPageIndex];
      if (current?.url) {
        await preloadImage(current.url).catch(() => {});
      }

      await preloadRange(currentPageIndex + 1, preloadCount);
      await preloadRange(currentPageIndex - 2, 2);
    };

    loadImages();
  }, [currentPageIndex, preloadCount, pages, preloadImage, preloadRange]);

  useEffect(() => {
    const loading = loadingImages.current;
    return () => {
      loading.clear();
    };
  }, [currentPageIndex]);

  useEffect(() => {
    imageCache.current.clear();
    loadingImages.current.clear();
    clearPreloadedImages();
  }, [chapterId, clearPreloadedImages]);

  const cancelPreloading = useCallback(() => {
    loadingImages.current.clear();
    imageCache.current.clear();
    clearPreloadedImages();
  }, [clearPreloadedImages]);

  return {
    preloadImage,
    cancelPreloading,
    imageCache: imageCache.current,
  };
}
