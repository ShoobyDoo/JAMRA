/**
 * Progress Batcher
 *
 * Batches download progress updates to reduce event emissions and database writes.
 * Instead of emitting an event on every page download, buffers updates and flushes
 * them at regular intervals (default: 1.5 seconds).
 *
 * This significantly reduces overhead during active downloads from 50-200 events
 * per chapter to 3-10 events per chapter.
 */

export interface ProgressUpdate {
  queueId: number;
  mangaId: string;
  chapterId?: string;
  progressCurrent: number;
  progressTotal: number;
}

export type ProgressUpdateCallback = (update: ProgressUpdate) => void;

export interface ProgressBatcherOptions {
  flushInterval?: number; // Milliseconds between flushes (default: 1500)
  flushOnComplete?: boolean; // Immediately flush when progress reaches 100% (default: true)
}

/**
 * Batches progress updates by time intervals to reduce event emissions
 */
export class ProgressBatcher {
  private readonly flushInterval: number;
  private readonly flushOnComplete: boolean;
  private readonly bufferedUpdates = new Map<number, ProgressUpdate>();
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly callback: ProgressUpdateCallback;

  constructor(callback: ProgressUpdateCallback, options: ProgressBatcherOptions = {}) {
    this.callback = callback;
    this.flushInterval = options.flushInterval ?? 1500;
    this.flushOnComplete = options.flushOnComplete ?? true;
  }

  /**
   * Record a progress update for batching
   */
  update(update: ProgressUpdate): void {
    // Store the latest update for this queue item
    this.bufferedUpdates.set(update.queueId, update);

    // If progress is complete and we're configured to flush on complete, do it now
    if (
      this.flushOnComplete &&
      update.progressCurrent >= update.progressTotal &&
      update.progressTotal > 0
    ) {
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
   * Immediately flush all buffered updates
   */
  flush(): void {
    // Clear the timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Nothing to flush
    if (this.bufferedUpdates.size === 0) {
      return;
    }

    // Emit all buffered updates
    for (const update of this.bufferedUpdates.values()) {
      try {
        this.callback(update);
      } catch (error) {
        console.error("Error in progress batcher callback:", error);
      }
    }

    // Clear the buffer
    this.bufferedUpdates.clear();
  }

  /**
   * Remove a specific item from the buffer (e.g., when download fails/completes)
   */
  remove(queueId: number): void {
    this.bufferedUpdates.delete(queueId);
  }

  /**
   * Check if there are pending updates
   */
  hasPending(): boolean {
    return this.bufferedUpdates.size > 0;
  }

  /**
   * Get count of pending updates
   */
  getPendingCount(): number {
    return this.bufferedUpdates.size;
  }

  /**
   * Clean up and flush any remaining updates
   */
  destroy(): void {
    this.flush();
  }
}
