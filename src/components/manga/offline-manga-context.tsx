"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ChapterWithSlug } from "@/lib/chapter-slug";
import {
  ApiError,
  cancelOfflineDownload,
  deleteOfflineChapter,
  getOfflineChapters,
  getOfflineMangaMetadata,
  getOfflineQueue,
  queueChapterDownload,
  queueMangaDownload,
  validateOfflineMangaMetadata,
  type OfflineChapterMetadata,
  type OfflineMangaMetadata,
  type OfflineQueuedDownload,
} from "@/lib/api";
import { RequestDeduplicator } from "@/lib/api/request-deduplicator";
import {
  useOfflineEvents,
  type OfflineDownloadEvent,
} from "@/hooks/use-offline-events";
import { logger } from "@/lib/logger";

export interface OfflineMangaContextValue {
  extensionId?: string;
  mangaId: string;
  mangaSlug: string;
  mangaTitle: string;
  chapters: ChapterWithSlug[];
  loading: boolean;
  offlineAvailable: boolean;
  offlineChaptersMap: Map<string, OfflineChapterMetadata>;
  offlineMetadata: OfflineMangaMetadata | null;
  queueItems: OfflineQueuedDownload[];
  chapterQueueMap: Map<string, OfflineQueuedDownload>;
  mangaQueueItems: OfflineQueuedDownload[];
  pendingChapterIds: Set<string>;
  queueingManga: boolean;
  refreshOfflineChapters: () => Promise<OfflineChapterMetadata[]>;
  refreshQueue: () => Promise<OfflineQueuedDownload[]>;
  queueChapter: (
    chapterId: string,
    options?: { priority?: number },
  ) => Promise<void>;
  queueManga: (
    chapterIds?: string[],
    options?: { priority?: number },
  ) => Promise<void>;
  cancelDownload: (queueId: number) => Promise<void>;
  deleteChapter: (chapterId: string) => Promise<void>;
  isChapterPending: (chapterId: string) => boolean;
}

const OfflineMangaContext = createContext<OfflineMangaContextValue | null>(
  null,
);

export interface OfflineMangaProviderProps {
  extensionId?: string;
  mangaId: string;
  mangaSlug: string;
  mangaTitle: string;
  chapters: ChapterWithSlug[];
  children: ReactNode;
}

export function OfflineMangaProvider({
  extensionId,
  mangaId,
  mangaSlug,
  mangaTitle,
  chapters,
  children,
}: OfflineMangaProviderProps) {
  const [loading, setLoading] = useState<boolean>(Boolean(extensionId));
  const [offlineAvailable, setOfflineAvailable] = useState<boolean>(
    Boolean(extensionId),
  );
  const [offlineChapters, setOfflineChapters] = useState<
    OfflineChapterMetadata[]
  >([]);
  const [offlineMetadata, setOfflineMetadata] =
    useState<OfflineMangaMetadata | null>(null);
  const [queueItems, setQueueItems] = useState<OfflineQueuedDownload[]>([]);
  const [pendingChapterIds, setPendingChapterIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [queueingManga, setQueueingManga] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [prevQueueLength, setPrevQueueLength] = useState(0);
  const queueRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const offlineChaptersMap = useMemo(() => {
    return new Map(
      offlineChapters.map((chapter) => [chapter.chapterId, chapter]),
    );
  }, [offlineChapters]);

  const chapterQueueMap = useMemo(() => {
    const map = new Map<string, OfflineQueuedDownload>();
    for (const item of queueItems) {
      if (item.chapterId) {
        map.set(item.chapterId, item);
      }
    }
    return map;
  }, [queueItems]);

  const mangaQueueItems = useMemo(
    () => queueItems.filter((item) => !item.chapterId),
    [queueItems],
  );

  const addPendingChapter = useCallback((chapterId: string) => {
    setPendingChapterIds((prev) => {
      if (prev.has(chapterId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(chapterId);
      return next;
    });
  }, []);

  const removePendingChapter = useCallback((chapterId: string) => {
    setPendingChapterIds((prev) => {
      if (!prev.has(chapterId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(chapterId);
      return next;
    });
  }, []);

  // Request deduplicator to prevent duplicate in-flight API calls
  const deduplicator = useMemo(() => new RequestDeduplicator(), []);

  const refreshOfflineChapters = useCallback(async () => {
    if (!extensionId) {
      setOfflineAvailable(false);
      setOfflineChapters([]);
      setOfflineMetadata(null);
      return [];
    }

    try {
      const key = RequestDeduplicator.makeKey(
        `/api/offline/chapters/${extensionId}/${mangaId}`,
        "GET",
      );

      const [chaptersResult, metadata] = await deduplicator.deduplicate(
        key,
        async () =>
          Promise.all([
            getOfflineChapters(extensionId, mangaId),
            getOfflineMangaMetadata(extensionId, mangaId),
          ]),
      );

      setOfflineChapters(chaptersResult);
      setOfflineMetadata(metadata);
      setOfflineAvailable(true);
      return chaptersResult;
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) {
        setOfflineAvailable(false);
        setOfflineChapters([]);
        setOfflineMetadata(null);
        return [];
      }
      throw error;
    }
  }, [extensionId, mangaId, deduplicator]);

  const refreshQueue = useCallback(async () => {
    if (!extensionId) {
      setQueueItems([]);
      setOfflineAvailable(false);
      return [];
    }

    try {
      const key = RequestDeduplicator.makeKey("/api/offline/queue", "GET");

      const queue = await deduplicator.deduplicate(key, () =>
        getOfflineQueue(),
      );

      const relevant = queue.filter(
        (item) => item.extensionId === extensionId && item.mangaId === mangaId,
      );
      setQueueItems(relevant);
      setOfflineAvailable(true);
      return relevant;
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) {
        setOfflineAvailable(false);
        setQueueItems([]);
        return [];
      }
      throw error;
    }
  }, [extensionId, mangaId, deduplicator]);

  // Debounced version of refreshQueue to avoid flooding during bulk operations
  const refreshQueueDebounced = useCallback(() => {
    if (queueRefreshTimeoutRef.current) {
      clearTimeout(queueRefreshTimeoutRef.current);
    }
    queueRefreshTimeoutRef.current = setTimeout(() => {
      refreshQueue().catch((error) => {
        logger.error("Failed to refresh queue (debounced)", {
          component: "OfflineMangaContext",
          action: "refresh-queue-debounced",
          mangaId,
          extensionId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    }, 500); // 500ms debounce
  }, [refreshQueue, mangaId, extensionId]);

  useEffect(() => {
    if (!extensionId) {
      setOfflineAvailable(false);
      setOfflineChapters([]);
      setOfflineMetadata(null);
      setQueueItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      try {
        await Promise.all([refreshOfflineChapters(), refreshQueue()]);

        // Validate metadata chapter count to catch mismatches early
        // This runs in background and doesn't block the UI
        if (extensionId) {
          validateOfflineMangaMetadata(extensionId, mangaId)
            .then((result) => {
              if (result.rebuilt) {
                logger.info("Metadata was rebuilt due to chapter count mismatch", {
                  component: "OfflineMangaContext",
                  action: "validate-metadata",
                  mangaId,
                  extensionId,
                });
                // Refresh to show updated metadata
                refreshOfflineChapters().catch((error) => {
                  logger.error("Failed to refresh after metadata rebuild", {
                    component: "OfflineMangaContext",
                    action: "refresh-after-validation",
                    mangaId,
                    extensionId,
                    error: error instanceof Error ? error : new Error(String(error)),
                  });
                });
              }
            })
            .catch((error) => {
              // Validation failure is not critical, just log it
              logger.warn("Failed to validate metadata", {
                component: "OfflineMangaContext",
                action: "validate-metadata",
                mangaId,
                extensionId,
                error: error instanceof Error ? error : new Error(String(error)),
              });
            });
        }
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 503)) {
          logger.error("Failed to load offline data", {
            component: "OfflineMangaContext",
            action: "initial-load",
            mangaId,
            extensionId,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialData().catch((error) => {
      logger.error("Unhandled error during offline data load", {
        component: "OfflineMangaContext",
        action: "initial-load",
        mangaId,
        extensionId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [extensionId, mangaId, refreshOfflineChapters, refreshQueue]);

  // Use SSE for real-time updates instead of polling
  const { connected } = useOfflineEvents({
    enabled: Boolean(extensionId),
    onEvent: useCallback(
      (event: OfflineDownloadEvent) => {
        // Only process events for this manga
        if (event.mangaId && event.mangaId !== mangaId) {
          return;
        }

        switch (event.type) {
          case "download-queued":
            // New item added to queue - debounced refresh to avoid flooding during bulk operations
            refreshQueueDebounced();
            break;

          case "download-started":
          case "download-progress":
            if (event.queueId !== undefined) {
              setQueueItems((prev) => {
                const existing = prev.find((item) => item.id === event.queueId);
                if (!existing) {
                  // Item not in local state - ignore the event
                  // This can happen during initial load or race conditions
                  // SSE events are the source of truth, so we trust this update
                  // Next refreshQueue() call will sync the state
                  return prev;
                }

                return prev.map((item) => {
                  if (item.id === event.queueId) {
                    return {
                      ...item,
                      status: "downloading" as const,
                      progressCurrent:
                        event.progressCurrent ?? item.progressCurrent,
                      progressTotal: event.progressTotal ?? item.progressTotal,
                    };
                  }
                  return item;
                });
              });
            }
            break;

          case "download-completed":
            if (event.queueId !== undefined) {
              if (event.chapterId) {
                addPendingChapter(event.chapterId);
              }

              // Remove completed item from queue
              setQueueItems((prev) =>
                prev.filter((item) => item.id !== event.queueId),
              );

              // Refresh offline chapters to show newly downloaded content
              refreshOfflineChapters()
                .catch((error) => {
                  if (!(error instanceof ApiError && error.status === 503)) {
                    logger.error(
                      "Failed to refresh offline chapters after download completed",
                      {
                        component: "OfflineMangaContext",
                        action: "refresh-after-complete",
                        mangaId,
                        extensionId,
                        queueId: event.queueId,
                        error: error instanceof Error
                          ? error
                          : new Error(String(error)),
                      },
                    );
                  }
                })
                .finally(() => {
                  if (event.chapterId) {
                    removePendingChapter(event.chapterId);
                  }
                });
            } else if (event.chapterId) {
              addPendingChapter(event.chapterId);
              refreshOfflineChapters()
                .catch((error) => {
                  if (!(error instanceof ApiError && error.status === 503)) {
                    logger.error(
                      "Failed to refresh offline chapters after download completed",
                      {
                        component: "OfflineMangaContext",
                        action: "refresh-after-complete",
                        mangaId,
                        extensionId,
                        queueId: event.queueId,
                        error: error instanceof Error
                          ? error
                          : new Error(String(error)),
                      },
                    );
                  }
                })
                .finally(() => {
                  if (event.chapterId) {
                    removePendingChapter(event.chapterId);
                  }
                });
            }
            break;

          case "download-failed":
            if (event.queueId !== undefined) {
              setQueueItems((prev) =>
                prev.map((item) => {
                  if (item.id === event.queueId) {
                    return {
                      ...item,
                      status: "failed" as const,
                      errorMessage: event.error,
                    };
                  }
                  return item;
                }),
              );
            }
            break;

          case "chapter-deleted":
            if (event.chapterId) {
              refreshOfflineChapters().catch((error) => {
                if (!(error instanceof ApiError && error.status === 503)) {
                  logger.error(
                    "Failed to refresh offline chapters after chapter deletion",
                    {
                      component: "OfflineMangaContext",
                      action: "refresh-after-chapter-delete",
                      mangaId,
                      extensionId,
                      chapterId: event.chapterId,
                      error: error instanceof Error
                        ? error
                        : new Error(String(error)),
                    },
                  );
                }
              });
            }
            break;

          case "manga-deleted":
            refreshOfflineChapters().catch((error) => {
              if (!(error instanceof ApiError && error.status === 503)) {
                logger.error("Failed to refresh offline chapters after manga deletion", {
                  component: "OfflineMangaContext",
                  action: "refresh-after-manga-delete",
                  mangaId,
                  extensionId,
                  error: error instanceof Error ? error : new Error(String(error)),
                });
              }
            });
            break;
        }
      },
      [extensionId, mangaId, refreshQueue, refreshQueueDebounced, refreshOfflineChapters],
    ),
  });

  // Update SSE connected state
  useEffect(() => {
    setSseConnected(connected);
  }, [connected]);

  // Detect when queue transitions to empty and do final refresh to catch any missed events
  useEffect(() => {
    const currentQueueLength = queueItems.length;

    // If queue just became empty (was non-empty, now empty), do a final refresh
    if (extensionId && prevQueueLength > 0 && currentQueueLength === 0) {
      logger.info("Queue became empty, doing final refresh to catch any missed updates", {
        component: "OfflineMangaContext",
        action: "queue-empty-refresh",
        mangaId,
        extensionId,
      });

      Promise.all([refreshOfflineChapters(), refreshQueue()]).catch((error) => {
        if (!(error instanceof ApiError && error.status === 503)) {
          logger.error("Failed to do final refresh after queue emptied", {
            component: "OfflineMangaContext",
            action: "queue-empty-refresh",
            mangaId,
            extensionId,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });
    }

    setPrevQueueLength(currentQueueLength);
  }, [extensionId, mangaId, queueItems.length, prevQueueLength, refreshOfflineChapters, refreshQueue]);

  // Fallback polling when SSE is disconnected - only if there are active downloads
  useEffect(() => {
    const hasActiveDownloads = queueItems.length > 0;
    if (!extensionId || sseConnected || loading || !hasActiveDownloads) {
      return; // Skip if no extension, SSE is connected, still loading, or no active downloads
    }

    const pollInterval = setInterval(() => {
      Promise.all([refreshOfflineChapters(), refreshQueue()]).catch((error) => {
        if (!(error instanceof ApiError && error.status === 503)) {
          logger.error("Failed to poll offline data", {
            component: "OfflineMangaContext",
            action: "poll-data",
            mangaId,
            extensionId,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });
    }, 20000); // Poll every 20 seconds when SSE is disconnected and downloads are active

    return () => {
      clearInterval(pollInterval);
    };
  }, [extensionId, mangaId, sseConnected, loading, queueItems.length, refreshOfflineChapters, refreshQueue]);

  // Refresh when page becomes visible - catches missed events when user navigates back
  useEffect(() => {
    if (!extensionId) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        logger.info("Page became visible, refreshing offline data", {
          component: "OfflineMangaContext",
          action: "visibility-refresh",
          mangaId,
          extensionId,
        });

        Promise.all([refreshOfflineChapters(), refreshQueue()]).catch((error) => {
          if (!(error instanceof ApiError && error.status === 503)) {
            logger.error("Failed to refresh on visibility change", {
              component: "OfflineMangaContext",
              action: "visibility-refresh",
              mangaId,
              extensionId,
              error: error instanceof Error ? error : new Error(String(error)),
            });
          }
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [extensionId, mangaId, refreshOfflineChapters, refreshQueue]);

  const queueChapter = useCallback(
    async (chapterId: string, options: { priority?: number } = {}) => {
      if (!extensionId) {
        throw new Error("Offline downloads are not available.");
      }

      addPendingChapter(chapterId);

      try {
        const response = await queueChapterDownload(
          extensionId,
          mangaId,
          chapterId,
          options.priority ?? 0,
        );

        const now = Date.now();
        setQueueItems((prev) => {
          const filtered = prev.filter(
            (item) =>
              item.id !== response.queueId && item.chapterId !== chapterId,
          );
          const nextItem: OfflineQueuedDownload = {
            id: response.queueId,
            extensionId,
            mangaId,
            mangaSlug,
            chapterId,
            status: "queued",
            priority: options.priority ?? 0,
            queuedAt: now,
            startedAt: undefined,
            completedAt: undefined,
            errorMessage: undefined,
            progressCurrent: 0,
            progressTotal: 0,
          };
          return [...filtered, nextItem];
        });

        await refreshQueue();
      } catch (error) {
        // If backend says chapter is already downloaded, refresh our local cache
        if (error instanceof Error && error.message.includes("already downloaded")) {
          logger.info("Chapter already downloaded, refreshing local cache", {
            component: "OfflineMangaContext",
            action: "queue-chapter",
            chapterId,
            mangaId,
          });
          // Refresh to sync the offlineChaptersMap
          await refreshOfflineChapters();
        }
        // Re-throw the error so UI can handle it
        throw error;
      } finally {
        removePendingChapter(chapterId);
      }
    },
    [
      extensionId,
      mangaId,
      mangaSlug,
      addPendingChapter,
      removePendingChapter,
      refreshQueue,
      refreshOfflineChapters,
    ],
  );

  const queueManga = useCallback(
    async (chapterIds?: string[], options: { priority?: number } = {}) => {
      if (!extensionId) {
        throw new Error("Offline downloads are not available.");
      }

      const uniqueChapterIds = chapterIds
        ? Array.from(new Set(chapterIds.filter(Boolean)))
        : undefined;

      if (uniqueChapterIds && uniqueChapterIds.length > 0) {
        setPendingChapterIds((prev) => {
          const next = new Set(prev);
          for (const id of uniqueChapterIds) {
            next.add(id);
          }
          return next;
        });
      }

      setQueueingManga(true);
      try {
        await queueMangaDownload(extensionId, mangaId, {
          chapterIds: uniqueChapterIds,
          priority: options.priority ?? 0,
        });
        await refreshQueue();
      } finally {
        setQueueingManga(false);
        if (uniqueChapterIds && uniqueChapterIds.length > 0) {
          setPendingChapterIds((prev) => {
            const next = new Set(prev);
            for (const id of uniqueChapterIds) {
              next.delete(id);
            }
            return next;
          });
        }
      }
    },
    [extensionId, mangaId, refreshQueue],
  );

  const cancelDownload = useCallback(
    async (queueId: number) => {
      await cancelOfflineDownload(queueId);
      await refreshQueue();
    },
    [refreshQueue],
  );

  const deleteChapter = useCallback(
    async (chapterId: string) => {
      if (!extensionId) {
        throw new Error("Offline downloads are not available.");
      }
      await deleteOfflineChapter(extensionId, mangaId, chapterId);
      await refreshOfflineChapters();
    },
    [extensionId, mangaId, refreshOfflineChapters],
  );

  const isChapterPending = useCallback(
    (chapterId: string) => pendingChapterIds.has(chapterId),
    [pendingChapterIds],
  );

  const value: OfflineMangaContextValue = {
    extensionId,
    mangaId,
    mangaSlug,
    mangaTitle,
    chapters,
    loading,
    offlineAvailable,
    offlineChaptersMap,
    offlineMetadata,
    queueItems,
    chapterQueueMap,
    mangaQueueItems,
    pendingChapterIds,
    queueingManga,
    refreshOfflineChapters,
    refreshQueue,
    queueChapter,
    queueManga,
    cancelDownload,
    deleteChapter,
    isChapterPending,
  };

  return (
    <OfflineMangaContext.Provider value={value}>
      {children}
    </OfflineMangaContext.Provider>
  );
}

export function useOfflineMangaContext(): OfflineMangaContextValue | null {
  return useContext(OfflineMangaContext);
}

export function useOfflineManga(): OfflineMangaContextValue {
  const context = useOfflineMangaContext();
  if (!context) {
    throw new Error(
      "useOfflineManga must be used within an OfflineMangaProvider",
    );
  }
  return context;
}
