/**
 * Download Subscription Hook
 * Subscribe to WebSocket events for specific download IDs
 * Use this when viewing download details to reduce traffic
 */

import { useEffect } from "react";
import { wsClient } from "../lib/websocket-client";

/**
 * Hook to subscribe to specific download WebSocket events
 * Automatically subscribes on mount and unsubscribes on unmount
 *
 * @example
 * ```tsx
 * // In DownloadDetails component
 * useDownloadSubscription(downloadId);
 * ```
 */
export const useDownloadSubscription = (downloadId: string | undefined) => {
  useEffect(() => {
    if (!downloadId) return;

    console.log(`[WebSocket] Subscribing to download: ${downloadId}`);
    wsClient.subscribeToDownload(downloadId);

    return () => {
      console.log(`[WebSocket] Unsubscribing from download: ${downloadId}`);
      wsClient.unsubscribeFromDownload(downloadId);
    };
  }, [downloadId]);
};

/**
 * Hook to subscribe to multiple download WebSocket events
 * Useful when displaying a list of downloads
 *
 * @example
 * ```tsx
 * // In DownloadsPage
 * const downloadIds = downloads.map(d => d.id);
 * useDownloadSubscriptions(downloadIds);
 * ```
 */
export const useDownloadSubscriptions = (
  downloadIds: string[] | undefined,
) => {
  const joinedIds = downloadIds?.join(",") ?? "";

  useEffect(() => {
    if (!joinedIds) return;

    const ids = joinedIds.split(",");

    console.log(`[WebSocket] Subscribing to ${ids.length} downloads`);
    ids.forEach((id) => wsClient.subscribeToDownload(id));

    return () => {
      console.log(`[WebSocket] Unsubscribing from ${ids.length} downloads`);
      ids.forEach((id) => wsClient.unsubscribeFromDownload(id));
    };
  }, [joinedIds]);
};
