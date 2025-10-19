"use client";

import { useEffect, useRef, useState } from "react";

export interface OfflineDownloadEvent {
  type:
    | "download-started"
    | "download-progress"
    | "download-completed"
    | "download-failed"
    | "chapter-deleted"
    | "manga-deleted";
  queueId?: number;
  mangaId?: string;
  chapterId?: string;
  progressCurrent?: number;
  progressTotal?: number;
  error?: string;
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

  useEffect(() => {
    if (!enabled || offlineStorageDisabledRef.current) {
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
            // Offline storage is not available - don't try to connect
            offlineStorageDisabledRef.current = true;
            setConnected(false);
            return;
          }
        } catch {
          if (cancelled) return;
          // Network error - will retry
          console.warn(
            "[Offline Events] Failed to check offline storage availability, will retry",
          );
        }

        const eventSource = new EventSource(
          `${normalizedApiBase}/offline/events`,
        );
        eventSourceRef.current = eventSource;

        eventSource.addEventListener("connected", () => {
          console.log("[Offline Events] Connected to SSE stream");
          setConnected(true);
          reconnectAttemptsRef.current = 0;
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

          // Only retry a few times before giving up
          if (reconnectAttemptsRef.current >= 3) {
            console.warn(
              "[Offline Events] Failed to connect after 3 attempts, offline features may not be available",
            );
            offlineStorageDisabledRef.current = true;
            return;
          }

          // Attempt to reconnect with exponential backoff
          const delay = Math.min(
            reconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
            30000,
          );
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        };
      } catch {
        console.warn(
          "[Offline Events] Failed to connect to SSE stream, offline features may not be available",
        );
        setConnected(false);
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
