"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useReaderSettings } from "@/store/reader-settings";
import { useReaderProgress } from "./hooks/use-reader-progress";
import { useReaderNavigation } from "./hooks/use-reader-navigation";
import { useSequentialPageLoader } from "./hooks/use-sequential-page-loader";
import { useReaderControls } from "@/hooks/use-reader-controls";
import { ReaderControls } from "./reader-controls";
import { ReaderSettingsPanel } from "./reader-settings-panel";
import { HotZoneIndicator } from "./hot-zone-indicator";
import { HotZoneHintOverlay } from "./hot-zone-hint-overlay";
import { ReaderViewport } from "./reader-viewport";
import { logger } from "@/lib/logger";
import { usePerformanceMonitor } from "@/hooks/use-performance-monitor";
import { useReaderHints } from "@/store/reader-hints";

type FullscreenCapableDocument = Document & {
  webkitExitFullscreen?: () => void | Promise<void>;
  mozCancelFullScreen?: () => void | Promise<void>;
  msExitFullscreen?: () => void | Promise<void>;
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
};

type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => void | Promise<void>;
  mozRequestFullScreen?: () => void | Promise<void>;
  msRequestFullscreen?: () => void | Promise<void>;
};

const getFullscreenDocument = (): FullscreenCapableDocument | null => {
  if (typeof document === "undefined") {
    return null;
  }
  return document as FullscreenCapableDocument;
};

const getActiveFullscreenElement = (
  doc: FullscreenCapableDocument,
): Element | null => {
  return (
    doc.fullscreenElement ??
    doc.webkitFullscreenElement ??
    doc.mozFullScreenElement ??
    doc.msFullscreenElement ??
    null
  );
};

const normalizePromise = (value: void | Promise<void> | undefined): Promise<void> => {
  if (
    value &&
    typeof value === "object" &&
    "then" in value &&
    typeof (value as Promise<void>).then === "function"
  ) {
    return value as Promise<void>;
  }
  return Promise.resolve();
};

const requestFullscreen = (element: FullscreenCapableElement): Promise<void> => {
  const request =
    element.requestFullscreen ??
    element.webkitRequestFullscreen ??
    element.mozRequestFullScreen ??
    element.msRequestFullscreen;

  if (!request) {
    return Promise.reject(new Error("Fullscreen API is not supported in this browser."));
  }

  try {
    return normalizePromise(request.call(element));
  } catch (error) {
    return Promise.reject(
      error instanceof Error ? error : new Error(String(error)),
    );
  }
};

const exitFullscreen = (doc: FullscreenCapableDocument): Promise<void> => {
  const exit =
    doc.exitFullscreen ??
    doc.webkitExitFullscreen ??
    doc.mozCancelFullScreen ??
    doc.msExitFullscreen;

  if (!exit) {
    return Promise.resolve();
  }

  try {
    return normalizePromise(exit.call(doc));
  } catch (error) {
    return Promise.reject(
      error instanceof Error ? error : new Error(String(error)),
    );
  }
};

interface MangaReaderProps {
  mangaId: string;
  mangaSlug: string;
  mangaTitle: string;
  chapterId: string;
  chapterSlug: string;
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
  extensionId,
  chapters = [],
  initialPage,
}: MangaReaderProps) {
  const {
    readingMode,
    zenMode,
    setZenMode,
    autoAdvanceChapter,
    initialPageCount,
    pageChunkSize,
    showHotzoneHints,
  } = useReaderSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const router = useRouter();
  const hasShownSessionHint = useReaderHints(
    (state) => state.hasShownSessionHint,
  );
  const markSessionHintShown = useReaderHints(
    (state) => state.markSessionHintShown,
  );

  const [shouldRenderHint, setShouldRenderHint] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const hintTimersRef = useRef<number[]>([]);
  const hasShownHintRef = useRef(hasShownSessionHint);

  const clearHintTimers = useCallback(() => {
    hintTimersRef.current.forEach((id) => window.clearTimeout(id));
    hintTimersRef.current = [];
  }, []);

  // Smart control bar visibility management
  const readerControls = useReaderControls({ mode: readingMode });
  const { pinControls, unpinControls } = readerControls;
  usePerformanceMonitor("MangaReader", {
    detail: { mangaId, chapterId, readingMode },
  });

  // Load pages sequentially
  const {
    pages,
    totalPages,
    isLoading: isPagesLoading,
    loadingProgress,
    error: loadingError,
    retry: retryLoading,
    loadPage,
  } = useSequentialPageLoader(mangaId, chapterId, extensionId, {
    initialPageCount,
    chunkSize: pageChunkSize,
    enableImagePreload: true,
  });

  useEffect(() => {
    if (hasShownSessionHint) {
      hasShownHintRef.current = true;
    }
  }, [hasShownSessionHint]);

  useEffect(() => {
    if (!showHotzoneHints || hasShownHintRef.current) {
      return;
    }

    hasShownHintRef.current = true;
    markSessionHintShown();
    setShouldRenderHint(true);

    const showTimer = window.setTimeout(() => setHintVisible(true), 50);
    const hideTimer = window.setTimeout(() => setHintVisible(false), 2200);
    const cleanupTimer = window.setTimeout(
      () => setShouldRenderHint(false),
      2700,
    );

    hintTimersRef.current = [showTimer, hideTimer, cleanupTimer];

    return () => {
      clearHintTimers();
    };
  }, [showHotzoneHints, markSessionHintShown, clearHintTimers]);

  useEffect(() => {
    if (!showHotzoneHints) {
      clearHintTimers();
      setHintVisible(false);
      setShouldRenderHint(false);
    }
  }, [showHotzoneHints, clearHintTimers]);

  // Manage reading progress
  const {
    currentPage,
    totalPages: readerTotalPages,
    goToPage: baseGoToPage,
  } = useReaderProgress(mangaId, chapterId, totalPages, initialPage);

  const viewportRef = useRef<HTMLDivElement>(null);

  // Find next and previous chapters
  const { nextChapter, prevChapter } = useMemo(() => {
    const index = chapters.findIndex((chapter) => chapter.id === chapterId);
    return {
      nextChapter:
        index >= 0 && index < chapters.length - 1
          ? chapters[index + 1]
          : null,
      prevChapter: index > 0 ? chapters[index - 1] : null,
    };
  }, [chapters, chapterId]);

  // Enhanced page navigation with loading support
  const goToPage = useCallback(
    async (pageIndex: number) => {
      if (pageIndex < 0 || pageIndex >= totalPages) {
        return;
      }

      // Ensure page is loaded before navigating
      if (!pages[pageIndex]) {
        await loadPage(pageIndex);
      }

      baseGoToPage(pageIndex);
    },
    [baseGoToPage, loadPage, pages, totalPages],
  );

  const nextPage = useCallback(async () => {
    const target = currentPage + 1;
    if (target >= totalPages) {
      // At end of chapter - check for next chapter
      if (autoAdvanceChapter && nextChapter) {
        router.push(
          `/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`,
        );
      }
      return;
    }
    await goToPage(target);
  }, [
    currentPage,
    totalPages,
    autoAdvanceChapter,
    nextChapter,
    router,
    mangaSlug,
    goToPage,
  ]);

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

  // Chapter navigation
  const handleChapterSelect = useCallback(
    (targetSlug: string) => {
      if (!targetSlug || targetSlug === chapterSlug) return;
      const targetChapter = chapters.find(
        (chapter) => chapter.slug === targetSlug,
      );
      if (!targetChapter) return;
      const url = `/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(targetChapter.slug)}`;
      router.push(url);
    },
    [chapters, chapterSlug, mangaSlug, router],
  );

  // UI controls
  const handleToggleZenMode = useCallback(() => {
    const fullscreenDoc = getFullscreenDocument();
    if (!fullscreenDoc || !fullscreenDoc.documentElement) {
      setZenMode(!zenMode);
      return;
    }

    const activeFullscreenElement = getActiveFullscreenElement(fullscreenDoc);

    if (activeFullscreenElement) {
      void exitFullscreen(fullscreenDoc)
        .catch((error) => {
          logger.error("Failed to exit fullscreen", {
            component: "MangaReader",
            error: error instanceof Error ? error : new Error(String(error)),
          });
        })
        .finally(() => {
          setZenMode(false);
        });
      return;
    }

    void requestFullscreen(
      fullscreenDoc.documentElement as FullscreenCapableElement,
    )
      .then(() => {
        setZenMode(true);
      })
      .catch((error) => {
        logger.error("Failed to enter fullscreen", {
          component: "MangaReader",
          error: error instanceof Error ? error : new Error(String(error)),
        });
        // Fall back to zen mode without fullscreen
        setZenMode(!zenMode);
      });
  }, [zenMode, setZenMode]);

  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen((value) => !value);
  }, []);

  const handleExitReader = useCallback(() => {
    const fullscreenDoc = getFullscreenDocument();
    if (fullscreenDoc) {
      void exitFullscreen(fullscreenDoc).catch((error) => {
        logger.error("Failed to exit fullscreen while leaving reader", {
          component: "MangaReader",
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    }
    setZenMode(false);
  }, [setZenMode]);

  // Keyboard navigation
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

  // Fullscreen change handler
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

  // Prefetch next chapter when approaching end
  useEffect(() => {
    if (
      !autoAdvanceChapter ||
      !chapters.length ||
      currentPage !== readerTotalPages - 1 ||
      !nextChapter
    ) {
      return;
    }
    const prefetchUrl = `/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`;
    router.prefetch(prefetchUrl);
  }, [
    autoAdvanceChapter,
    chapters,
    currentPage,
    mangaSlug,
    nextChapter,
    readerTotalPages,
    router,
  ]);

  // Determine if we're loading the current page
  const currentPageData = useMemo(
    () => pages[currentPage] ?? null,
    [pages, currentPage],
  );
  const isCurrentPagePending = useMemo(
    () => isPagesLoading && !currentPageData,
    [isPagesLoading, currentPageData],
  );

  const handlePageSelect = useCallback(
    (pageIndex: number) => {
      void goToPage(pageIndex);
    },
    [goToPage],
  );

  const handleNextPage = useCallback(() => {
    void nextPage();
  }, [nextPage]);

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <ReaderViewport
        ref={viewportRef}
        pages={pages}
        currentPage={currentPage}
        totalPages={totalPages}
        readingMode={readingMode}
        mangaId={mangaId}
        mangaSlug={mangaSlug}
        readerControls={readerControls}
        nextChapter={nextChapter}
        prevChapter={prevChapter}
        onPageChange={handlePageSelect}
        onPrevPage={prevPage}
        onNextPage={handleNextPage}
        isPagesLoading={isPagesLoading}
        loadingProgress={loadingProgress}
        loadingError={loadingError}
        onRetry={retryLoading}
      />

      {shouldRenderHint && (
        <HotZoneHintOverlay
          readingMode={readingMode}
          visible={hintVisible}
        />
      )}

      {/* Hot zone indicator - shown across all reading modes */}
      <HotZoneIndicator zone={readerControls.currentHotZone} />

      <ReaderControls
        mangaSlug={mangaSlug}
        mangaTitle={mangaTitle}
        chapters={chapters}
        currentChapterSlug={chapterSlug}
        onChapterSelect={handleChapterSelect}
        currentPage={currentPage}
        totalPages={totalPages}
        isChunkPending={isCurrentPagePending}
        chunkErrorMessage={loadingError?.message}
        onRetryChunk={retryLoading}
        onPrevPage={prevPage}
        onNextPage={handleNextPage}
        onToggleSettings={handleToggleSettings}
        onToggleZenMode={handleToggleZenMode}
        onPageSelect={handlePageSelect}
        showControls={readerControls.showControls}
        onControlsPointerEnter={pinControls}
        onControlsPointerLeave={unpinControls}
      />

      <ReaderSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
