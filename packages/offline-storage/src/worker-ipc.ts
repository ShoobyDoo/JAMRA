/**
 * IPC protocol shared between the catalog server (parent) and the offline
 * worker (child). Defines every command, payload, and response exchanged over
 * the Node IPC channel so both sides stay fully type-safe.
 */

import type {
  DownloadChapterOptions,
  DownloadHistoryItem,
  DownloadMangaOptions,
  DownloadProgress,
  OfflineChapterMetadata,
  OfflineChapterPages,
  OfflineMangaMetadata,
  OfflineStorageEvent,
  QueuedDownload,
  StorageStats,
} from "./types.js";
import type { DownloadWorkerOptions } from "./downloader.js";
import type { PerformanceMetrics } from "./utils/performance-metrics.js";

// ============================================================================
// Worker boot configuration
// ============================================================================

export interface WorkerInitConfig {
  dataDir: string;
  dbPath: string;
  extensionPath: string;
  extensionId: string;
  workerOptions: DownloadWorkerOptions;
}

// ============================================================================
// Command / response contracts
// ============================================================================

export interface WorkerCommandPayloads {
  start: void;
  stop: void;
  ping: void;
  "is-active": void;
  "get-active-downloads": void;
  "queue-chapter": {
    extensionId: string;
    mangaId: string;
    chapterId: string;
    options?: DownloadChapterOptions;
  };
  "queue-manga": {
    extensionId: string;
    mangaId: string;
    options?: DownloadMangaOptions;
  };
  "cancel-download": {
    queueId: number;
  };
  "retry-download": {
    queueId: number;
  };
  "retry-frozen-downloads": void;
  "get-queued-downloads": void;
  "get-download-progress": {
    queueId: number;
  };
  "get-storage-stats": void;
  "get-downloaded-manga": void;
  "get-manga-metadata": {
    extensionId: string;
    mangaId: string;
  };
  "get-downloaded-chapters": {
    extensionId: string;
    mangaId: string;
  };
  "get-chapter-pages": {
    extensionId: string;
    mangaId: string;
    chapterId: string;
  };
  "is-chapter-downloaded": {
    extensionId: string;
    mangaId: string;
    chapterId: string;
  };
  "delete-chapter": {
    extensionId: string;
    mangaId: string;
    chapterId: string;
  };
  "delete-manga": {
    extensionId: string;
    mangaId: string;
  };
  "nuke-offline-data": void;
  "get-download-history": {
    limit?: number;
  };
  "delete-history-item": {
    historyId: number;
  };
  "clear-download-history": void;
  "validate-manga-chapter-count": {
    extensionId: string;
    mangaId: string;
  };
  "start-background-sync": {
    ttlMs: number;
    concurrency?: number;
    delayMs?: number;
  };
  "get-page-path": {
    mangaId: string;
    chapterId: string;
    filename: string;
  };
  "get-metrics": void;
  "reset-metrics": void;
}

export interface WorkerResultMap {
  start: void;
  stop: void;
  ping: { timestamp: number };
  "is-active": { isActive: boolean };
  "get-active-downloads": { activeDownloads: number[] };
  "queue-chapter": { queueId: number };
  "queue-manga": { queueIds: number[] };
  "cancel-download": void;
  "retry-download": void;
  "retry-frozen-downloads": { retriedQueueIds: number[] };
  "get-queued-downloads": { queue: QueuedDownload[] };
  "get-download-progress": { progress: DownloadProgress | null };
  "get-storage-stats": { stats: StorageStats };
  "get-downloaded-manga": { manga: OfflineMangaMetadata[] };
  "get-manga-metadata": { metadata: OfflineMangaMetadata | null };
  "get-downloaded-chapters": {
    chapters: OfflineChapterMetadata[];
  };
  "get-chapter-pages": { pages: OfflineChapterPages | null };
  "is-chapter-downloaded": { downloaded: boolean };
  "delete-chapter": void;
  "delete-manga": void;
  "nuke-offline-data": void;
  "get-download-history": { history: DownloadHistoryItem[] };
  "delete-history-item": void;
  "clear-download-history": void;
  "validate-manga-chapter-count": { valid: boolean; rebuilt: boolean };
  "start-background-sync": void;
  "get-page-path": { path: string | null };
  "get-metrics": { metrics: PerformanceMetrics };
  "reset-metrics": void;
}

export type WorkerCommandType = keyof WorkerCommandPayloads;

type WorkerCommandMap = {
  [K in WorkerCommandType]: WorkerCommandPayloads[K] extends void
    ? { type: K; requestId?: string }
    : { type: K; requestId?: string; payload: WorkerCommandPayloads[K] };
};

export type WorkerCommand = WorkerCommandMap[WorkerCommandType];

export type ResultForCommand<T extends WorkerCommandType> =
  WorkerResultMap[T];

// ============================================================================
// Worker → parent messages
// ============================================================================

export type WorkerMessage =
  | { type: "ready"; timestamp: number }
  | { type: "started"; timestamp: number; requestId?: string }
  | { type: "stopped"; timestamp: number; requestId?: string }
  | { type: "event"; event: OfflineStorageEvent }
  | {
      type: "result";
      requestId: string;
      command: WorkerCommandType;
      result: unknown;
    }
  | { type: "error"; requestId?: string; error: string; stack?: string }
  | { type: "fatal-error"; error: string; stack?: string };

// ============================================================================
// Type guards
// ============================================================================

export function isWorkerCommand(message: unknown): message is WorkerCommand {
  if (typeof message !== "object" || message === null) return false;
  const type = (message as { type?: unknown }).type;
  if (typeof type !== "string") return false;

  return ([
    "start",
    "stop",
    "ping",
    "is-active",
    "get-active-downloads",
    "queue-chapter",
    "queue-manga",
    "cancel-download",
    "retry-download",
    "retry-frozen-downloads",
    "get-queued-downloads",
    "get-download-progress",
    "get-storage-stats",
    "get-downloaded-manga",
    "get-manga-metadata",
    "get-downloaded-chapters",
    "get-chapter-pages",
    "is-chapter-downloaded",
    "delete-chapter",
    "delete-manga",
    "nuke-offline-data",
    "get-download-history",
    "delete-history-item",
    "clear-download-history",
    "validate-manga-chapter-count",
    "start-background-sync",
    "get-page-path",
    "get-metrics",
    "reset-metrics",
  ] satisfies string[]).includes(type);
}

export function isWorkerMessage(message: unknown): message is WorkerMessage {
  if (typeof message !== "object" || message === null) return false;
  const type = (message as { type?: unknown }).type;
  if (typeof type !== "string") return false;

  return ([
    "ready",
    "started",
    "stopped",
    "event",
    "result",
    "error",
    "fatal-error",
  ] satisfies string[]).includes(type);
}

// ============================================================================
// IPC timeout configuration
// ============================================================================

export interface IPCTimeouts {
  startTimeout: number;
  stopTimeout: number;
  queryTimeout: number;
  readyTimeout: number;
}

export const DEFAULT_IPC_TIMEOUTS: IPCTimeouts = {
  startTimeout: 10_000,
  stopTimeout: 5_000,
  queryTimeout: 5_000,
  readyTimeout: 15_000,
};
