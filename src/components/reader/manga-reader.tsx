import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { useReaderControls } from "../../hooks/useReaderControls";
import { useReaderHints } from "../../store/useReaderHintsStore";
import { useReaderSettings } from "../../store/useReaderSettingsStore";
import { useReaderNavigation } from "./hooks/use-reader-navigation";
import { useReaderProgress } from "./hooks/use-reader-progress";
import { useSequentialPageLoader } from "./hooks/use-sequential-page-loader";
import { HotZoneHintOverlay } from "./hot-zone-hint-overlay";
import { HotZoneIndicator } from "./hot-zone-indicator";
import { ReaderControls } from "./reader-controls";
import { ReaderSettingsPanel } from "./reader-settings-panel";
import { ReaderViewport } from "./reader-viewport";

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
  if (typeof document === "undefined") return null;
  return document as FullscreenCapableDocument;
};

const getActiveFullscreenElement = (
  doc: FullscreenCapableDocument,
): Element | null =>
  doc.fullscreenElement ??
  doc.webkitFullscreenElement ??
  doc.mozFullScreenElement ??
  doc.msFullscreenElement ??
  null;

const normalizePromise = (
  value: void | Promise<void> | undefined,
): Promise<void> => {
  if (value && typeof value === "object" && "then" in value)
    return value as Promise<void>;
  return Promise.resolve();
};

const requestFullscreen = (
  element: FullscreenCapableElement,
): Promise<void> => {
  const request =
    element.requestFullscreen ??
    element.webkitRequestFullscreen ??
    element.mozRequestFullScreen ??
    element.msRequestFullscreen;

  if (!request)
    return Promise.reject(new Error("Fullscreen API not supported."));

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

  if (!exit) return Promise.resolve();

  try {
    return normalizePromise(exit.call(doc));
  } catch (error) {
    return Promise.reject(
      error instanceof Error ? error : new Error(String(error)),
    );
  }
};

interface ChapterMeta {
  id: string;
  title?: string;
  number?: string;
}

interface MangaReaderProps {
  libraryId: string;
  mangaTitle: string;
  chapterId: string;
  initialPage?: number;
}

export const MangaReader: React.FC<MangaReaderProps> = ({
  libraryId,
  mangaTitle,
  chapterId,
  initialPage,
}) => {
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
  const navigate = useNavigate();

  const hasShownSessionHint = useReaderHints(
    (state) => state.hasShownSessionHint,
  );
  const markSessionHintShown = useReaderHints(
    (state) => state.markSessionHintShown,
  );

  const [hintState, setHintState] = useState({
    shouldRender: false,
    isVisible: false,
  });
  const hintTimersRef = useRef<number[]>([]);
  const hasShownHintRef = useRef(hasShownSessionHint);

  const clearHintTimers = useCallback(() => {
    hintTimersRef.current.forEach((id) => window.clearTimeout(id));
    hintTimersRef.current = [];
  }, []);

  const readerControls = useReaderControls({ mode: readingMode });
  const { pinControls, unpinControls } = readerControls;

  const {
    pages,
    totalPages,
    isLoading: isPagesLoading,
    loadingProgress,
    error: loadingError,
    retry: retryLoading,
    loadPage,
    chapterMeta,
  } = useSequentialPageLoader(libraryId, chapterId, {
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
    if (!showHotzoneHints || hasShownHintRef.current) return;

    hasShownHintRef.current = true;
    markSessionHintShown();

    const mountTimer = window.setTimeout(
      () => setHintState({ shouldRender: true, isVisible: false }),
      0,
    );
    const showTimer = window.setTimeout(
      () => setHintState((s) => ({ ...s, isVisible: true })),
      50,
    );
    const hideTimer = window.setTimeout(
      () => setHintState((s) => ({ ...s, isVisible: false })),
      2200,
    );
    const cleanupTimer = window.setTimeout(
      () => setHintState({ shouldRender: false, isVisible: false }),
      2700,
    );

    hintTimersRef.current = [mountTimer, showTimer, hideTimer, cleanupTimer];
    return () => clearHintTimers();
  }, [showHotzoneHints, markSessionHintShown, clearHintTimers]);

  useEffect(() => {
    if (!showHotzoneHints) {
      clearHintTimers();
    }
  }, [showHotzoneHints, clearHintTimers]);

  const {
    currentPage,
    totalPages: readerTotalPages,
    goToPage: baseGoToPage,
  } = useReaderProgress(libraryId, chapterId, totalPages, initialPage);

  const viewportRef = useRef<HTMLDivElement>(null);

  const { nextChapter, prevChapter, chapterList } = useMemo(() => {
    const prev = chapterMeta?.previousChapterId
      ? { id: chapterMeta.previousChapterId }
      : null;
    const next = chapterMeta?.nextChapterId
      ? { id: chapterMeta.nextChapterId }
      : null;
    const current: ChapterMeta = {
      id: chapterId,
      title: chapterMeta?.title,
      number: chapterMeta?.number,
    };
    const list: ChapterMeta[] = [];
    if (prev) list.push(prev);
    list.push(current);
    if (next) list.push(next);
    return { nextChapter: next, prevChapter: prev, chapterList: list };
  }, [chapterId, chapterMeta]);

  const goToPage = useCallback(
    async (pageIndex: number) => {
      if (pageIndex < 0 || pageIndex >= totalPages) return;
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
      if (autoAdvanceChapter && nextChapter) {
        navigate(`/reader/${libraryId}/chapters/${nextChapter.id}`);
      }
      return;
    }
    await goToPage(target);
  }, [
    currentPage,
    totalPages,
    autoAdvanceChapter,
    nextChapter,
    navigate,
    libraryId,
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

  const handleNavigateToChapter = useCallback(
    (targetChapterId: string) => {
      if (!targetChapterId || targetChapterId === chapterId) return;
      navigate(`/reader/${libraryId}/chapters/${targetChapterId}`);
    },
    [chapterId, libraryId, navigate],
  );

  const handleToggleZenMode = useCallback(() => {
    const fullscreenDoc = getFullscreenDocument();
    if (!fullscreenDoc?.documentElement) {
      setZenMode(!zenMode);
      return;
    }

    const activeFullscreenElement = getActiveFullscreenElement(fullscreenDoc);

    if (activeFullscreenElement) {
      void exitFullscreen(fullscreenDoc).finally(() => setZenMode(false));
      return;
    }

    void requestFullscreen(
      fullscreenDoc.documentElement as FullscreenCapableElement,
    )
      .then(() => setZenMode(true))
      .catch(() => setZenMode(!zenMode));
  }, [zenMode, setZenMode]);

  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen((v) => !v);
  }, []);

  const handleExitReader = useCallback(() => {
    const fullscreenDoc = getFullscreenDocument();
    if (fullscreenDoc) {
      void exitFullscreen(fullscreenDoc).catch(() => {});
    }
    setZenMode(false);
  }, [setZenMode]);

  useReaderNavigation({
    onNextPage: () => void nextPage(),
    onPrevPage: prevPage,
    onFirstPage: firstPage,
    onLastPage: () => void lastPage(),
    onToggleZenMode: handleToggleZenMode,
    onToggleSettings: handleToggleSettings,
    onCycleModes: () => {},
    onExitReader: handleExitReader,
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setZenMode(false);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [setZenMode]);

  const currentPageData = useMemo(
    () => pages[currentPage] ?? null,
    [pages, currentPage],
  );
  const isCurrentPagePending = useMemo(
    () => isPagesLoading && !currentPageData,
    [isPagesLoading, currentPageData],
  );

  const handlePageSelect = useCallback(
    (pageIndex: number) => void goToPage(pageIndex),
    [goToPage],
  );

  const handleNextPage = useCallback(() => void nextPage(), [nextPage]);

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-black">
      <ReaderViewport
        ref={viewportRef}
        pages={pages}
        currentPage={currentPage}
        totalPages={totalPages}
        readingMode={readingMode}
        mangaId={libraryId}
        mangaSlug={libraryId}
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
        onNavigateToChapter={handleNavigateToChapter}
      />

      {showHotzoneHints && hintState.shouldRender && (
        <HotZoneHintOverlay
          readingMode={readingMode}
          visible={hintState.isVisible}
        />
      )}

      <HotZoneIndicator zone={readerControls.currentHotZone} />

      <ReaderControls
        mangaTitle={mangaTitle}
        chapters={chapterList}
        currentChapterId={chapterId}
        onChapterSelect={handleNavigateToChapter}
        currentPage={currentPage}
        totalPages={readerTotalPages}
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
};
