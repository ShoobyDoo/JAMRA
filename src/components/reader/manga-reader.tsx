"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useReaderSettings } from "@/store/reader-settings";
import { useReaderProgress } from "./hooks/use-reader-progress";
import { useReaderNavigation } from "./hooks/use-reader-navigation";
import { useTouchGestures } from "./hooks/use-touch-gestures";
import { useSequentialPageLoader } from "./hooks/use-sequential-page-loader";
import { PagedMode } from "./reading-modes/paged-mode";
import { DualPageMode } from "./reading-modes/dual-page-mode";
import { VerticalMode } from "./reading-modes/vertical-mode";
import { ReaderControls } from "./reader-controls";
import { ReaderSettingsPanel } from "./reader-settings-panel";

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
    pageFit,
    setPageFit,
    autoAdvanceChapter,
    initialPageCount,
    pageChunkSize,
  } = useReaderSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const router = useRouter();

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

  // Manage reading progress
  const {
    currentPage,
    totalPages: readerTotalPages,
    goToPage: baseGoToPage,
  } = useReaderProgress(mangaId, chapterId, totalPages, initialPage);

  const viewportRef = useRef<HTMLDivElement>(null);

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
      if (autoAdvanceChapter && chapters.length > 0) {
        const currentIndex = chapters.findIndex((ch) => ch.id === chapterId);
        if (currentIndex >= 0 && currentIndex < chapters.length - 1) {
          const nextChapter = chapters[currentIndex + 1];
          router.push(
            `/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`,
          );
        }
      }
      return;
    }
    await goToPage(target);
  }, [
    currentPage,
    totalPages,
    autoAdvanceChapter,
    chapters,
    chapterId,
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
      const targetChapter = chapters.find((chapter) => chapter.slug === targetSlug);
      if (!targetChapter) return;
      const url = `/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(targetChapter.slug)}`;
      router.push(url);
    },
    [chapters, chapterSlug, mangaSlug, router],
  );

  // UI controls
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

  // Touch gestures
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

  // Find next and previous chapters
  const currentChapterIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1
      ? chapters[currentChapterIndex + 1]
      : null;
  const prevChapter =
    currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null;

  // Determine if we're loading the current page
  const currentPageData = pages[currentPage];
  const isCurrentPagePending = isPagesLoading && !currentPageData;

  // Render appropriate reading mode
  const renderReadingMode = () => {
    const onPageChange = (pageIndex: number) => {
      void goToPage(pageIndex);
    };

    const props = {
      pages,
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
        {/* Always render reading mode - let it handle its own loading states */}
        {renderReadingMode()}

        {/* Loading progress indicator (shown while loading in background) */}
        {isPagesLoading && loadingProgress < 100 && (
          <div className="absolute top-4 right-4 rounded-md bg-black/75 px-3 py-2 text-sm text-white">
            Loading pages: {loadingProgress}%
          </div>
        )}

        {/* Error display */}
        {loadingError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90">
            <p className="text-sm text-muted-foreground text-center px-4">
              {loadingError.message || "Failed to load chapter pages."}
            </p>
            <button
              type="button"
              onClick={retryLoading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        )}
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
        chunkErrorMessage={loadingError?.message}
        onRetryChunk={retryLoading}
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
