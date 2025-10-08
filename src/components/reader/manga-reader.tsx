"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fetchChapterPagesChunk } from "@/lib/api";
import { useReaderSettings } from "@/store/reader-settings";
import { useReaderProgress } from "./hooks/use-reader-progress";
import { useChapterPagePreloader } from "./hooks/use-chapter-page-preloader";
import { useReaderNavigation } from "./hooks/use-reader-navigation";
import { useTouchGestures } from "./hooks/use-touch-gestures";
import { PagedMode } from "./reading-modes/paged-mode";
import { DualPageMode } from "./reading-modes/dual-page-mode";
import { VerticalMode } from "./reading-modes/vertical-mode";
import { ReaderControls } from "./reader-controls";
import { ReaderSettingsPanel } from "./reader-settings-panel";

interface PageImage {
  index: number;
  url: string;
  width?: number;
  height?: number;
}

interface MangaReaderProps {
  mangaId: string;
  mangaSlug: string;
  mangaTitle: string;
  chapterId: string;
  chapterSlug: string;
  initialPages: PageImage[];
  totalPages: number;
  initialChunkSize: number;
  initialChunkIndex: number;
  totalChunks: number;
  extensionId?: string;
  chapters?: Array<{
    id: string;
    slug: string;
    title?: string;
    number?: string;
  }>;
  initialPage?: number;
}

export function MangaReader({
  mangaId,
  mangaSlug,
  mangaTitle,
  chapterId,
  chapterSlug,
  initialPages,
  totalPages,
  initialChunkSize,
  initialChunkIndex,
  totalChunks,
  extensionId,
  chapters = [],
  initialPage,
}: MangaReaderProps) {
  const {
    readingMode,
    zenMode,
    setZenMode,
    pageFit,
    setPageFit,
    autoAdvanceChapter,
  } = useReaderSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const pagesRef = useRef<Array<PageImage | null>>(
    Array.from({ length: totalPages }, () => null),
  );
  const [pagesVersion, setPagesVersion] = useState(0);
  const chunkSizeRef = useRef(Math.max(initialChunkSize, 1));
  const totalChunksRef = useRef(Math.max(totalChunks, 1));
  const loadedChunksRef = useRef(new Set<number>());
  const loadingChunkPromisesRef = useRef(new Map<number, Promise<void>>());
  const sequentialQueueRef = useRef<number[]>([]);
  const sequentialLoadingRef = useRef(false);

  const [pendingPageIndex, setPendingPageIndex] = useState<number | null>(null);
  const [activeError, setActiveError] = useState<Error | null>(null);

  const {
    currentPage,
    totalPages: readerTotalPages,
    goToPage: baseGoToPage,
  } = useReaderProgress(mangaId, chapterId, totalPages, initialPage);

  const storePages = useCallback((incoming: PageImage[]) => {
    if (incoming.length === 0) return;
    const copy = [...pagesRef.current];
    let changed = false;
    incoming.forEach((page) => {
      if (page.index >= 0 && page.index < copy.length) {
        if (!copy[page.index]) {
          copy[page.index] = page;
          changed = true;
        }
      }
    });
    if (changed) {
      pagesRef.current = copy;
      setPagesVersion((value) => value + 1);
    }
  }, []);

  const loadChunk = useCallback(
    (chunkIndex: number): Promise<void> => {
      if (chunkIndex < 0) {
        return Promise.resolve();
      }

      const totalChunkCount = totalChunksRef.current;
      if (chunkIndex >= totalChunkCount) {
        return Promise.resolve();
      }

      if (loadedChunksRef.current.has(chunkIndex)) {
        return Promise.resolve();
      }

      const existing = loadingChunkPromisesRef.current.get(chunkIndex);
      if (existing) {
        return existing;
      }

      const promise = (async () => {
        try {
          const chunk = await fetchChapterPagesChunk(
            mangaId,
            chapterId,
            chunkIndex,
            Math.max(chunkSizeRef.current, 1),
            extensionId,
          );

          chunkSizeRef.current = Math.max(chunk.chunkSize, 1);
          totalChunksRef.current = Math.max(chunk.totalChunks, 1);

          const baseIndex = chunk.chunk * chunk.chunkSize;
          const normalized = chunk.pages.map((page, offset) => ({
            ...page,
            index:
              typeof page.index === "number"
                ? page.index
                : baseIndex + offset,
          }));

          storePages(normalized);
          loadedChunksRef.current.add(chunkIndex);
        } finally {
          loadingChunkPromisesRef.current.delete(chunkIndex);
        }
      })();

      loadingChunkPromisesRef.current.set(chunkIndex, promise);
      return promise;
    },
    [chapterId, extensionId, mangaId, storePages],
  );

  const processSequentialQueue = useCallback(async () => {
    if (sequentialLoadingRef.current) return;
    sequentialLoadingRef.current = true;
    try {
      while (sequentialQueueRef.current.length > 0) {
        const next = sequentialQueueRef.current.shift();
        if (next === undefined) break;
        if (loadedChunksRef.current.has(next)) {
          continue;
        }
        try {
          await loadChunk(next);
        } catch (error) {
          // Requeue and stop processing; we'll retry later.
          sequentialQueueRef.current.unshift(next);
          console.error("Failed to load chunk", next, error);
          break;
        }
      }
    } finally {
      sequentialLoadingRef.current = false;
    }
  }, [loadChunk]);

  const enqueueSequentialChunks = useCallback(() => {
    const totalChunkCount = totalChunksRef.current;
    const queue: number[] = [];
    for (let index = 0; index < totalChunkCount; index += 1) {
      if (!loadedChunksRef.current.has(index)) {
        queue.push(index);
      }
    }
    sequentialQueueRef.current = queue;
    void processSequentialQueue();
  }, [processSequentialQueue]);

  const ensurePageAvailable = useCallback(
    async (pageIndex: number): Promise<void> => {
      if (pageIndex < 0 || pageIndex >= totalPages) {
        return;
      }

      if (pagesRef.current[pageIndex]) {
        return;
      }

      const chunkIndex = Math.floor(
        pageIndex / Math.max(chunkSizeRef.current, 1),
      );

      await loadChunk(chunkIndex);
    },
    [loadChunk, totalPages],
  );

  const goToPage = useCallback(
    async (pageIndex: number) => {
      if (pageIndex < 0 || pageIndex >= totalPages) {
        return;
      }

      setPendingPageIndex(pageIndex);
      setActiveError(null);

      try {
        await ensurePageAvailable(pageIndex);
        baseGoToPage(pageIndex);
      } catch (error) {
        const normalized =
          error instanceof Error ? error : new Error(String(error));
        setActiveError(normalized);
      } finally {
        setPendingPageIndex((value) => (value === pageIndex ? null : value));
      }
    },
    [baseGoToPage, ensurePageAvailable, totalPages],
  );

  const nextPage = useCallback(async () => {
    const target = currentPage + 1;
    if (target >= totalPages) return;
    await goToPage(target);
  }, [currentPage, goToPage, totalPages]);

  const prevPage = useCallback(() => {
    const target = currentPage - 1;
    if (target < 0) return;
    void goToPage(target);
  }, [currentPage, goToPage]);

  const firstPage = useCallback(() => {
    void goToPage(0);
  }, [goToPage]);

  const lastPage = useCallback(() => {
    const target = totalPages - 1;
    if (target < 0) return;
    void goToPage(target);
  }, [goToPage, totalPages]);

  useEffect(() => {
    const initialize = async () => {
      const storage = Array.from({ length: totalPages }, () => null as PageImage | null);
      initialPages.forEach((page) => {
        if (page.index >= 0 && page.index < storage.length) {
          storage[page.index] = page;
        }
      });
      pagesRef.current = storage;
      setPagesVersion((value) => value + 1);

      chunkSizeRef.current = Math.max(initialChunkSize, 1);
      totalChunksRef.current = Math.max(totalChunks, 1);
      loadedChunksRef.current = new Set<number>();
      if (initialPages.length > 0) {
        loadedChunksRef.current.add(initialChunkIndex);
      }
      loadingChunkPromisesRef.current.clear();
      sequentialQueueRef.current = [];
      sequentialLoadingRef.current = false;

      const targetPage =
        typeof initialPage === "number"
          ? Math.max(0, Math.min(initialPage, totalPages - 1))
          : 0;

      if (!pagesRef.current[targetPage]) {
        try {
          await ensurePageAvailable(targetPage);
        } catch (error) {
          const normalized =
            error instanceof Error ? error : new Error(String(error));
          setActiveError(normalized);
        }
      }

      enqueueSequentialChunks();
    };

    void initialize();
  }, [
    chapterId,
    totalPages,
    initialPages,
    initialChunkSize,
    initialChunkIndex,
    totalChunks,
    initialPage,
    ensurePageAvailable,
    enqueueSequentialChunks,
  ]);

  useEffect(() => {
    const hasPage = Boolean(pagesRef.current[currentPage]);
    if (!hasPage && pendingPageIndex === null) {
      void goToPage(currentPage);
    }
  }, [currentPage, goToPage, pendingPageIndex]);

  const viewportRef = useRef<HTMLDivElement>(null);

  const loadedPages = useMemo(() => {
    void pagesVersion;
    return pagesRef.current
      .filter((page): page is PageImage => page !== null)
      .sort((a, b) => a.index - b.index);
  }, [pagesVersion]);

  useChapterPagePreloader(loadedPages, currentPage, chapterId);

  const router = useRouter();

  const handleChapterSelect = useCallback(
    (targetSlug: string) => {
      if (!targetSlug || targetSlug === chapterSlug) return;
      const targetChapter = chapters.find((chapter) => chapter.slug === targetSlug);
      if (!targetChapter) return;
      const url = `/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(targetChapter.slug)}`;
      if (router) {
        router.push(url);
      } else {
        window.location.href = url;
      }
    },
    [chapters, chapterSlug, mangaSlug, router],
  );

  const handleToggleZenMode = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
    setZenMode(!zenMode);
  }, [zenMode, setZenMode]);

  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen((value) => !value);
  }, []);

  const handleExitReader = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setZenMode(false);
  }, [setZenMode]);

  useReaderNavigation({
    onNextPage: () => {
      void nextPage();
    },
    onPrevPage: prevPage,
    onFirstPage: firstPage,
    onLastPage: () => {
      void lastPage();
    },
    onToggleZenMode: handleToggleZenMode,
    onToggleSettings: handleToggleSettings,
    onCycleModes: () => {},
    onExitReader: handleExitReader,
  });

  useTouchGestures(viewportRef, {
    onSwipeLeft:
      readingMode === "paged-rtl"
        ? prevPage
        : () => {
            void nextPage();
          },
    onSwipeRight:
      readingMode === "paged-rtl"
        ? () => {
            void nextPage();
          }
        : prevPage,
    onDoubleTap: () => {
      if (pageFit === "width") {
        setPageFit("height");
      } else {
        setPageFit("width");
      }
    },
    onLongPress: handleToggleSettings,
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setZenMode(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [setZenMode]);

  useEffect(() => {
    if (
      !autoAdvanceChapter ||
      !chapters.length ||
      currentPage !== readerTotalPages - 1
    ) {
      return;
    }
    const currentIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
    if (currentIndex === -1 || currentIndex >= chapters.length - 1) {
      return;
    }
    const nextChapter = chapters[currentIndex + 1];
    const prefetchUrl = `/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`;
    router.prefetch(prefetchUrl);
  }, [
    autoAdvanceChapter,
    chapters,
    chapterId,
    currentPage,
    mangaSlug,
    readerTotalPages,
    router,
  ]);

  const currentChapterIndex = useMemo(
    () => chapters.findIndex((chapter) => chapter.id === chapterId),
    [chapters, chapterId],
  );
  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1
      ? chapters[currentChapterIndex + 1]
      : null;
  const prevChapter =
    currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null;

  const currentPageData = pagesRef.current[currentPage];
  const isCurrentPagePending = pendingPageIndex !== null || !currentPageData;

  const renderReadingMode = () => {
    const onPageChange = (pageIndex: number) => {
      void goToPage(pageIndex);
    };

    const props = {
      pages: pagesRef.current,
      currentPage,
      totalPages,
      onPageChange,
      nextChapter,
      prevChapter,
      mangaId,
      mangaSlug,
    };

    switch (readingMode) {
      case "paged-ltr":
      case "paged-rtl":
        return <PagedMode {...props} />;
      case "dual-page":
        return <DualPageMode {...props} />;
      case "vertical":
        return <VerticalMode {...props} />;
      default:
        return <PagedMode {...props} />;
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <div ref={viewportRef} className="relative flex-1 overflow-hidden">
        {renderReadingMode()}
        {activeError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90">
            <p className="text-sm text-muted-foreground text-center px-4">
              {activeError.message || "Failed to load this page."}
            </p>
            <button
              type="button"
              onClick={() => {
                if (pendingPageIndex !== null) {
                  void goToPage(pendingPageIndex);
                } else {
                  void goToPage(currentPage);
                }
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>

      <ReaderControls
        mangaSlug={mangaSlug}
        mangaTitle={mangaTitle}
        chapters={chapters}
        currentChapterSlug={chapterSlug}
        onChapterSelect={handleChapterSelect}
        currentPage={currentPage}
        totalPages={totalPages}
        isChunkPending={isCurrentPagePending}
        chunkErrorMessage={activeError?.message}
        onRetryChunk={() => {
          void goToPage(currentPage);
        }}
        onPrevPage={prevPage}
        onNextPage={() => {
          void nextPage();
        }}
        onToggleSettings={handleToggleSettings}
        onToggleZenMode={handleToggleZenMode}
        onPageSelect={(pageIndex) => {
          void goToPage(pageIndex);
        }}
      />

      <ReaderSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
