"use client";

import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";

export interface OfflineDownloadEvent {
  type:
    | "download-queued"
    | "download-started"
    | "download-progress"
    | "download-completed"
    | "download-failed"
    | "chapter-deleted"
    | "manga-deleted"
    | "new-chapters-available";
  queueId?: number;
  mangaId?: string;
  chapterId?: string;
  progressCurrent?: number;
  progressTotal?: number;
  error?: string;
  newChapterCount?: number;
}

export interface UseOfflineEventsOptions {
  onEvent?: (event: OfflineDownloadEvent) => void;
  enabled?: boolean;
  reconnectDelay?: number;
}

export function useOfflineEvents(options: UseOfflineEventsOptions = {}) {
  const { onEvent, enabled = true, reconnectDelay = 3000 } = options;
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<OfflineDownloadEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const offlineStorageDisabledRef = useRef(false);
  const lastSuccessfulCheckRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const connect = async () => {
      if (cancelled) return;

      try {
        const rawApiBase =
          process.env.NEXT_PUBLIC_JAMRA_API_URL ?? "http://localhost:4545/api";
        const normalizedApiBase = rawApiBase.replace(/\/+$/, "");

        // Check if offline storage is available before connecting
        try {
          const checkResponse = await fetch(
            `${normalizedApiBase}/offline/queue`,
            {
              method: "HEAD",
            },
          );

          if (cancelled) return;

          if (checkResponse.status === 503 || checkResponse.status === 404) {
            // Offline storage is not available - schedule retry
            logger.warn(
              "Offline storage not available, will retry in 10 seconds",
              {
                component: "useOfflineEvents",
                action: "check-availability",
              },
            );
            reconnectTimeoutRef.current = window.setTimeout(() => {
              connect();
            }, 10000); // Retry after 10 seconds
            setConnected(false);
            return;
          }

          // Storage is available - reset the disabled flag and record success
          offlineStorageDisabledRef.current = false;
          lastSuccessfulCheckRef.current = Date.now();
        } catch {
          if (cancelled) return;
          // Network error - will retry
          logger.warn(
            "Failed to check offline storage availability; will retry",
            {
              component: "useOfflineEvents",
              action: "check-availability",
            },
          );
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, 5000); // Retry after 5 seconds
          return;
        }

        const eventSource = new EventSource(
          `${normalizedApiBase}/offline/events`,
        );
        eventSourceRef.current = eventSource;

        eventSource.addEventListener("connected", () => {
          logger.info("Connected to offline SSE stream", {
            component: "useOfflineEvents",
            action: "connected",
          });
          setConnected(true);
          reconnectAttemptsRef.current = 0; // Reset retry counter on successful connection
          offlineStorageDisabledRef.current = false; // Ensure disabled flag is cleared
        });

        eventSource.addEventListener("download-queued", (e) => {
          const event = JSON.parse(e.data) as OfflineDownloadEvent;
          setLastEvent(event);
          onEvent?.(event);
        });

        eventSource.addEventListener("download-started", (e) => {
          const event = JSON.parse(e.data) as OfflineDownloadEvent;
          setLastEvent(event);
          onEvent?.(event);
        });

        eventSource.addEventListener("download-progress", (e) => {
          const event = JSON.parse(e.data) as OfflineDownloadEvent;
          setLastEvent(event);
          onEvent?.(event);
        });

        eventSource.addEventListener("download-completed", (e) => {
          const event = JSON.parse(e.data) as OfflineDownloadEvent;
          setLastEvent(event);
          onEvent?.(event);
        });

        eventSource.addEventListener("download-failed", (e) => {
          const event = JSON.parse(e.data) as OfflineDownloadEvent;
          setLastEvent(event);
          onEvent?.(event);
        });

        eventSource.addEventListener("chapter-deleted", (e) => {
          const event = JSON.parse(e.data) as OfflineDownloadEvent;
          setLastEvent(event);
          onEvent?.(event);
        });

        eventSource.addEventListener("manga-deleted", (e) => {
          const event = JSON.parse(e.data) as OfflineDownloadEvent;
          setLastEvent(event);
          onEvent?.(event);
        });

        eventSource.addEventListener("new-chapters-available", (e) => {
          const event = JSON.parse(e.data) as OfflineDownloadEvent;
          setLastEvent(event);
          onEvent?.(event);
        });

        eventSource.addEventListener("heartbeat", () => {
          // Heartbeat received - connection is alive
        });

        eventSource.onerror = () => {
          // EventSource errors are not very informative, so we just handle reconnection
          setConnected(false);

          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }

          // Keep retrying indefinitely with exponential backoff
          // After 3 failed attempts, use a longer retry interval
          const maxAttempts = 3;
          const shortDelay = Math.min(
            reconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
            10000, // Max 10 seconds for initial retries
          );
          const longDelay = 30000; // 30 seconds for subsequent retries

          const delay = reconnectAttemptsRef.current >= maxAttempts
            ? longDelay
            : shortDelay;

          reconnectAttemptsRef.current++;

          logger.warn(
            `Offline events connection lost, reconnecting in ${delay / 1000}s`,
            {
              component: "useOfflineEvents",
              action: "reconnecting",
              attempts: reconnectAttemptsRef.current,
              delay,
            },
          );

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        };
      } catch (error) {
        logger.warn(
          "Failed to establish offline events SSE connection, will retry",
          {
            component: "useOfflineEvents",
            action: "connect-failure",
            error: error instanceof Error ? error : new Error(String(error)),
          },
        );
        setConnected(false);

        // Retry after a delay
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 5000);
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setConnected(false);
    };
  }, [enabled, onEvent, reconnectDelay]);

  return { connected, lastEvent };
}
