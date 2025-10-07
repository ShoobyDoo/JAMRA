"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useReaderSettings } from "@/store/reader-settings";
import { useReaderProgress } from "./hooks/use-reader-progress";
import { useReaderNavigation } from "./hooks/use-reader-navigation";
import { useImagePreloader } from "./hooks/use-image-preloader";
import { useTouchGestures } from "./hooks/use-touch-gestures";
import { PagedMode } from "./reading-modes/paged-mode";
import { DualPageMode } from "./reading-modes/dual-page-mode";
import { VerticalMode } from "./reading-modes/vertical-mode";
import { ReaderControls } from "./reader-controls";
import { ReaderSettingsPanel } from "./reader-settings-panel";

interface MangaReaderProps {
  mangaId: string;
  mangaTitle: string;
  chapterId: string;
  chapterTitle: string;
  pages: Array<{
    index: number;
    url: string;
    width?: number;
    height?: number;
  }>;
  chapters?: Array<{
    id: string;
    title?: string;
    number?: string;
  }>;
  initialPage?: number;
}

export function MangaReader({
  mangaId,
  mangaTitle,
  chapterId,
  chapterTitle,
  pages,
  chapters = [],
  initialPage,
}: MangaReaderProps) {
  const router = useRouter();
  const { readingMode, zenMode, setZenMode, pageFit, setPageFit, autoAdvanceChapter } = useReaderSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const {
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    goToPage,
  } = useReaderProgress(mangaId, chapterId, pages.length, initialPage);

  // Remove ?page=last query parameter after initial page is set
  useEffect(() => {
    if (initialPage !== undefined) {
      // Replace the URL without the query parameter
      const newUrl = `/read/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(chapterId)}`;
      router.replace(newUrl);
    }
  }, [initialPage, mangaId, chapterId, router]);

  // Find current chapter index and next/prev chapters
  const currentChapterIndex = chapters.findIndex((ch) => ch.id === chapterId);
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1
    ? chapters[currentChapterIndex + 1]
    : null;
  const prevChapter = currentChapterIndex > 0
    ? chapters[currentChapterIndex - 1]
    : null;

  // Image preloading
  useImagePreloader(pages, currentPage);

  const handleToggleZenMode = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Failed to enter fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
    setZenMode(!zenMode);
  }, [zenMode, setZenMode]);

  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen((prev) => !prev);
  }, []);

  const handleExitReader = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setZenMode(false);
  }, [setZenMode]);

  // Keyboard navigation
  useReaderNavigation({
    onNextPage: nextPage,
    onPrevPage: prevPage,
    onFirstPage: firstPage,
    onLastPage: lastPage,
    onToggleZenMode: handleToggleZenMode,
    onToggleSettings: handleToggleSettings,
    onCycleModes: () => {
      // Cycle modes is handled inside the hook
    },
    onExitReader: handleExitReader,
  });

  // Touch gestures
  useTouchGestures(viewportRef, {
    onSwipeLeft: readingMode === "paged-rtl" ? prevPage : nextPage,
    onSwipeRight: readingMode === "paged-rtl" ? nextPage : prevPage,
    onDoubleTap: () => {
      // Toggle between fit-width and fit-height on double tap
      if (pageFit === "width") {
        setPageFit("height");
      } else {
        setPageFit("width");
      }
    },
    onLongPress: handleToggleSettings,
  });

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setZenMode(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [setZenMode]);

  // Prefetch next chapter when on last page for seamless auto-advance
  useEffect(() => {
    if (!autoAdvanceChapter || !nextChapter || currentPage !== totalPages - 1) {
      return;
    }

    // Prefetch next chapter data by creating a link element
    // This tells the browser to prefetch the route in the background
    const prefetchUrl = `/read/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(nextChapter.id)}`;

    // Use Next.js router prefetch
    router.prefetch(prefetchUrl);

    // Note: No delay - when user navigates forward from last page,
    // the reading mode components will handle the navigation
    // The prefetch ensures it's instant
  }, [autoAdvanceChapter, nextChapter, currentPage, totalPages, mangaId, router]);

  const renderReadingMode = () => {
    const props = {
      pages,
      currentPage,
      onPageChange: goToPage,
      nextChapter,
      prevChapter,
      mangaId,
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
      {/* Reader viewport */}
      <div ref={viewportRef} className="relative flex-1 overflow-hidden">
        {renderReadingMode()}
      </div>

      {/* Controls overlay */}
      <ReaderControls
        mangaId={mangaId}
        mangaTitle={mangaTitle}
        chapterTitle={chapterTitle}
        currentPage={currentPage}
        totalPages={totalPages}
        onPrevPage={prevPage}
        onNextPage={nextPage}
        onToggleSettings={handleToggleSettings}
        onToggleZenMode={handleToggleZenMode}
        onPageSelect={goToPage}
      />

      {/* Settings panel */}
      <ReaderSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
