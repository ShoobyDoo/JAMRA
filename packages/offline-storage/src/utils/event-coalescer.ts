/**
 * Event Coalescer
 *
 * Batches and coalesces events before emitting them across IPC boundaries.
 * This reduces the number of messages sent between processes and improves performance.
 *
 * Features:
 * - Time-based batching (flush every N milliseconds)
 * - Automatic event consolidation (merge similar events)
 * - Immediate flush for critical events
 */

import type {
  OfflineStorageEvent,
  ConsolidatedOfflineEvent,
} from "../types.js";

export interface EventCoalescerOptions {
  flushInterval?: number; // Milliseconds between flushes (default: 500)
  maxBatchSize?: number; // Max events before forced flush (default: 50)
}

/**
 * Coalesces events into consolidated batches for efficient IPC transmission
 */
export class EventCoalescer {
  private readonly flushInterval: number;
  private readonly maxBatchSize: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private pendingEvents: OfflineStorageEvent[] = [];
  private readonly onFlush: (events: ConsolidatedOfflineEvent[]) => void;

  constructor(
    onFlush: (events: ConsolidatedOfflineEvent[]) => void,
    options: EventCoalescerOptions = {},
  ) {
    this.onFlush = onFlush;
    this.flushInterval = options.flushInterval ?? 500;
    this.maxBatchSize = options.maxBatchSize ?? 50;
  }

  /**
   * Add an event to the coalescing buffer
   */
  push(event: OfflineStorageEvent): void {
    this.pendingEvents.push(event);

    // Check if we should flush immediately
    const shouldFlushImmediately =
      event.type === "download-failed" ||
      event.type === "download-completed" ||
      this.pendingEvents.length >= this.maxBatchSize;

    if (shouldFlushImmediately) {
      this.flush();
      return;
    }

    // Schedule a flush if not already scheduled
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, this.flushInterval);
    }
  }

  /**
   * Immediately flush all pending events
   */
  flush(): void {
    // Clear the timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Nothing to flush
    if (this.pendingEvents.length === 0) {
      return;
    }

    // Consolidate events
    const consolidated = this.consolidateEvents(this.pendingEvents);

    // Clear pending events
    this.pendingEvents = [];

    // Emit consolidated events
    for (const event of consolidated) {
      try {
        this.onFlush([event]);
      } catch (error) {
        console.error("Error in event coalescer flush:", error);
      }
    }
  }

  /**
   * Consolidate multiple events into optimized batches
   */
  private consolidateEvents(
    events: OfflineStorageEvent[],
  ): ConsolidatedOfflineEvent[] {
    const consolidated: ConsolidatedOfflineEvent[] = [];

    // Group events by type
    const queueUpdates: OfflineStorageEvent[] = [];
    const downloadUpdates: OfflineStorageEvent[] = [];
    const contentUpdates: OfflineStorageEvent[] = [];
    const systemEvents: OfflineStorageEvent[] = [];

    for (const event of events) {
      switch (event.type) {
        case "download-queued":
        case "download-retried":
          queueUpdates.push(event);
          break;
        case "download-started":
        case "download-progress":
        case "download-completed":
        case "download-failed":
          downloadUpdates.push(event);
          break;
        case "chapter-deleted":
        case "manga-deleted":
        case "new-chapters-available":
          contentUpdates.push(event);
          break;
        case "cleanup-performed":
          systemEvents.push(event);
          break;
      }
    }

    // Build queue-update event
    if (queueUpdates.length > 0) {
      consolidated.push({
        type: "queue-update",
        items: queueUpdates.map((e) => ({
          queueId: "queueId" in e ? e.queueId : 0,
          mangaId: "mangaId" in e ? e.mangaId : "",
          chapterId: "chapterId" in e ? e.chapterId : undefined,
          state: e.type === "download-queued" ? "queued" : "retried",
        })),
      });
    }

    // Build download-update event (deduplicate by queueId, keep latest)
    if (downloadUpdates.length > 0) {
      const latestByQueue = new Map<number, OfflineStorageEvent>();
      for (const event of downloadUpdates) {
        if ("queueId" in event) {
          latestByQueue.set(event.queueId, event);
        }
      }

      consolidated.push({
        type: "download-update",
        items: Array.from(latestByQueue.values()).map((e) => {
          const base = {
            queueId: "queueId" in e ? e.queueId : 0,
            mangaId: "mangaId" in e ? e.mangaId : "",
            chapterId: "chapterId" in e ? e.chapterId : undefined,
          };

          switch (e.type) {
            case "download-started":
              return { ...base, state: "started" as const };
            case "download-progress":
              return {
                ...base,
                state: "progress" as const,
                progressCurrent: "progressCurrent" in e ? e.progressCurrent : 0,
                progressTotal: "progressTotal" in e ? e.progressTotal : 0,
              };
            case "download-completed":
              return { ...base, state: "completed" as const };
            case "download-failed":
              return {
                ...base,
                state: "failed" as const,
                error: "error" in e ? e.error : "Unknown error",
              };
            default:
              return { ...base, state: "started" as const };
          }
        }),
      });
    }

    // Build content-update event
    if (contentUpdates.length > 0) {
      consolidated.push({
        type: "content-update",
        updates: contentUpdates.map((e) => {
          switch (e.type) {
            case "chapter-deleted":
              return {
                action: "chapter-deleted" as const,
                mangaId: e.mangaId,
                chapterId: e.chapterId,
              };
            case "manga-deleted":
              return {
                action: "manga-deleted" as const,
                mangaId: e.mangaId,
              };
            case "new-chapters-available":
              return {
                action: "new-chapters" as const,
                mangaId: e.mangaId,
                count: e.newChapterCount,
              };
            default:
              return {
                action: "manga-deleted" as const,
                mangaId: "",
              };
          }
        }),
      });
    }

    // Build system events
    for (const event of systemEvents) {
      if (event.type === "cleanup-performed") {
        consolidated.push({
          type: "system",
          action: "cleanup-performed",
          deletedBytes: event.deletedBytes,
          deletedChapters: event.deletedChapters,
        });
      }
    }

    return consolidated;
  }

  /**
   * Check if there are pending events
   */
  hasPending(): boolean {
    return this.pendingEvents.length > 0;
  }

  /**
   * Get count of pending events
   */
  getPendingCount(): number {
    return this.pendingEvents.length;
  }

  /**
   * Clean up and flush any remaining events
   */
  destroy(): void {
    this.flush();
  }
}
