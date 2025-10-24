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

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const rawApiBase =
        process.env.NEXT_PUBLIC_JAMRA_API_URL ?? "http://localhost:4545/api";
      const normalizedApiBase = rawApiBase.replace(/\/+$/, "");

      logger.debug("Opening offline events SSE", {
        component: "useOfflineEvents",
        action: "connect",
      });

      const eventSource = new EventSource(
        `${normalizedApiBase}/offline/events`,
      );
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        logger.info("Connected to offline SSE stream", {
          component: "useOfflineEvents",
          action: "connected",
        });
        setConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.addEventListener("connected", () => {
        logger.debug("Offline SSE sent connected event", {
          component: "useOfflineEvents",
          action: "connected-event",
        });
        setConnected(true);
        reconnectAttemptsRef.current = 0;
      });

      // Consolidated event handler - single message listener with type routing
      // This reduces JSON parsing overhead from 8x to 1x per event
      const handleOfflineEvent = (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data) as OfflineDownloadEvent;
          setLastEvent(event);
          onEvent?.(event);
        } catch (error) {
          logger.error("Failed to parse offline event", {
            component: "useOfflineEvents",
            action: "parse-event",
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      };

      // Register listeners for all event types
      const eventTypes = [
        "download-queued",
        "download-started",
        "download-progress",
        "download-completed",
        "download-failed",
        "chapter-deleted",
        "manga-deleted",
        "new-chapters-available",
      ];

      for (const eventType of eventTypes) {
        eventSource.addEventListener(eventType, handleOfflineEvent);
      }

      eventSource.addEventListener("heartbeat", () => {
        logger.debug("Offline SSE heartbeat", {
          component: "useOfflineEvents",
          action: "heartbeat",
        });
      });

      const handleError = (error?: Event) => {
        setConnected(false);

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        const maxAttempts = 3;
        const shortDelay = Math.min(
          reconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
          10000,
        );
        const longDelay = 30000;
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
            error,
          },
        );

        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };

      eventSource.onerror = handleError;
    };

    try {
      connect();
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

      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 5000);
    };

    return () => {
      cancelled = true;
      if (eventSourceRef.current) {
        logger.info("Closing offline SSE connection (cleanup)", {
          component: "useOfflineEvents",
          action: "cleanup",
        });
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
