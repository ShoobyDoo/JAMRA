import { useEffect, useRef, useCallback } from "react";
import { useReaderSettings } from "@/store/reader-settings";
import { useReadingProgress } from "@/store/reading-progress";

export interface PageImage {
  index: number;
  url: string;
  width?: number;
  height?: number;
}

export function useImagePreloader(pages: PageImage[], currentPageIndex: number) {
  const { preloadCount } = useReaderSettings();
  const { addPreloadedImage, clearPreloadedImages } = useReadingProgress();
  const loadingImages = useRef<Set<string>>(new Set());
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const preloadImage = useCallback(
    (url: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if (imageCache.current.has(url)) {
          addPreloadedImage(url);
          resolve();
          return;
        }

        // Check if currently loading
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
    [addPreloadedImage]
  );

  const preloadRange = useCallback(
    async (startIndex: number, count: number) => {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < count; i++) {
        const pageIndex = startIndex + i;
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          if (page?.url) {
            promises.push(
              preloadImage(page.url).catch((error) => {
                console.warn(`Failed to preload page ${pageIndex}:`, error);
              })
            );
          }
        }
      }

      await Promise.all(promises);
    },
    [pages, preloadImage]
  );

  // Preload ahead and behind current page
  useEffect(() => {
    const loadImages = async () => {
      // Always preload current page first
      if (pages[currentPageIndex]?.url) {
        await preloadImage(pages[currentPageIndex].url).catch(() => {
          /* ignore */
        });
      }

      // Preload ahead (higher priority)
      await preloadRange(currentPageIndex + 1, preloadCount);

      // Preload behind (lower priority)
      await preloadRange(currentPageIndex - 2, 2);
    };

    loadImages();
  }, [currentPageIndex, preloadCount, pages, preloadImage, preloadRange]);

  // Cleanup on unmount or page change
  useEffect(() => {
    const loading = loadingImages.current;
    return () => {
      // Clear loading state but keep cache
      loading.clear();
    };
  }, [currentPageIndex]);

  // Clear cache and progress when pages change
  useEffect(() => {
    imageCache.current.clear();
    loadingImages.current.clear();
    clearPreloadedImages();
  }, [pages, clearPreloadedImages]);

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
