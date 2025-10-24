/**
 * Performance Metrics
 *
 * Tracks performance statistics for the offline storage system.
 * Provides insights into download performance, event emissions, database operations, etc.
 */

export interface PerformanceMetrics {
  // Download metrics
  totalDownloads: number;
  activeDownloads: number;
  completedDownloads: number;
  failedDownloads: number;
  totalPagesDownloaded: number;
  totalBytesDownloaded: number;

  // Event metrics
  eventsEmitted: number;
  eventsPerSecond: number;
  lastEventTimestamp: number;

  // Database metrics
  databaseWrites: number;
  databaseWritesPerSecond: number;
  batchedWrites: number;
  batchSavingsPercent: number;

  // Network metrics
  networkRequests: number;
  networkRequestsPerSecond: number;
  cachedRequests: number;
  cacheHitRate: number;

  // Timing metrics
  averageDownloadTimeMs: number;
  averagePageDownloadTimeMs: number;

  // Uptime
  uptimeMs: number;
  startTime: number;
}

interface DownloadTiming {
  startTime: number;
  endTime?: number;
  pagesDownloaded: number;
}

export class PerformanceMetricsTracker {
  private startTime = Date.now();

  // Download tracking
  private totalDownloads = 0;
  private activeDownloads = new Set<number>();
  private completedDownloads = 0;
  private failedDownloads = 0;
  private totalPagesDownloaded = 0;
  private totalBytesDownloaded = 0;
  private downloadTimings: DownloadTiming[] = [];

  // Event tracking
  private eventsEmitted = 0;
  private lastEventTimestamp = Date.now();
  private eventTimestamps: number[] = [];

  // Database tracking
  private databaseWrites = 0;
  private batchedWrites = 0;
  private dbWriteTimestamps: number[] = [];

  // Network tracking
  private networkRequests = 0;
  private cachedRequests = 0;
  private networkTimestamps: number[] = [];

  /**
   * Record a download started
   */
  downloadStarted(queueId: number): void {
    this.totalDownloads++;
    this.activeDownloads.add(queueId);
    this.downloadTimings.push({
      startTime: Date.now(),
      pagesDownloaded: 0,
    });
  }

  /**
   * Record a download completed
   */
  downloadCompleted(queueId: number, pagesDownloaded: number): void {
    this.activeDownloads.delete(queueId);
    this.completedDownloads++;
    this.totalPagesDownloaded += pagesDownloaded;

    // Update timing
    const timing = this.downloadTimings[this.downloadTimings.length - 1];
    if (timing) {
      timing.endTime = Date.now();
      timing.pagesDownloaded = pagesDownloaded;
    }
  }

  /**
   * Record a download failed
   */
  downloadFailed(queueId: number): void {
    this.activeDownloads.delete(queueId);
    this.failedDownloads++;
  }

  /**
   * Record bytes downloaded
   */
  bytesDownloaded(bytes: number): void {
    this.totalBytesDownloaded += bytes;
  }

  /**
   * Record an event emission
   */
  eventEmitted(): void {
    this.eventsEmitted++;
    this.lastEventTimestamp = Date.now();
    this.eventTimestamps.push(Date.now());
    this.pruneOldTimestamps(this.eventTimestamps);
  }

  /**
   * Record a database write
   */
  databaseWrite(): void {
    this.databaseWrites++;
    this.dbWriteTimestamps.push(Date.now());
    this.pruneOldTimestamps(this.dbWriteTimestamps);
  }

  /**
   * Record a batched database write
   */
  databaseBatchWrite(count: number): void {
    this.batchedWrites += count;
    this.dbWriteTimestamps.push(Date.now());
    this.pruneOldTimestamps(this.dbWriteTimestamps);
  }

  /**
   * Record a network request
   */
  networkRequest(): void {
    this.networkRequests++;
    this.networkTimestamps.push(Date.now());
    this.pruneOldTimestamps(this.networkTimestamps);
  }

  /**
   * Record a cached request (cache hit)
   */
  cacheHit(): void {
    this.cachedRequests++;
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): PerformanceMetrics {
    const now = Date.now();
    const uptimeMs = now - this.startTime;

    // Calculate per-second rates
    const eventsPerSecond = this.calculateRate(this.eventTimestamps);
    const databaseWritesPerSecond = this.calculateRate(this.dbWriteTimestamps);
    const networkRequestsPerSecond = this.calculateRate(this.networkTimestamps);

    // Calculate averages
    const completedTimings = this.downloadTimings.filter((t) => t.endTime);
    const averageDownloadTimeMs =
      completedTimings.length > 0
        ? completedTimings.reduce(
            (sum, t) => sum + (t.endTime! - t.startTime),
            0,
          ) / completedTimings.length
        : 0;

    const totalPages = completedTimings.reduce(
      (sum, t) => sum + t.pagesDownloaded,
      0,
    );
    const totalTime = completedTimings.reduce(
      (sum, t) => sum + (t.endTime! - t.startTime),
      0,
    );
    const averagePageDownloadTimeMs =
      totalPages > 0 ? totalTime / totalPages : 0;

    // Calculate batch savings
    const totalWrites = this.databaseWrites + this.batchedWrites;
    const batchSavingsPercent =
      totalWrites > 0 ? (this.batchedWrites / totalWrites) * 100 : 0;

    // Calculate cache hit rate
    const totalRequests = this.networkRequests + this.cachedRequests;
    const cacheHitRate =
      totalRequests > 0 ? (this.cachedRequests / totalRequests) * 100 : 0;

    return {
      totalDownloads: this.totalDownloads,
      activeDownloads: this.activeDownloads.size,
      completedDownloads: this.completedDownloads,
      failedDownloads: this.failedDownloads,
      totalPagesDownloaded: this.totalPagesDownloaded,
      totalBytesDownloaded: this.totalBytesDownloaded,

      eventsEmitted: this.eventsEmitted,
      eventsPerSecond,
      lastEventTimestamp: this.lastEventTimestamp,

      databaseWrites: this.databaseWrites,
      databaseWritesPerSecond,
      batchedWrites: this.batchedWrites,
      batchSavingsPercent,

      networkRequests: this.networkRequests,
      networkRequestsPerSecond,
      cachedRequests: this.cachedRequests,
      cacheHitRate,

      averageDownloadTimeMs,
      averagePageDownloadTimeMs,

      uptimeMs,
      startTime: this.startTime,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.startTime = Date.now();
    this.totalDownloads = 0;
    this.activeDownloads.clear();
    this.completedDownloads = 0;
    this.failedDownloads = 0;
    this.totalPagesDownloaded = 0;
    this.totalBytesDownloaded = 0;
    this.downloadTimings = [];
    this.eventsEmitted = 0;
    this.lastEventTimestamp = Date.now();
    this.eventTimestamps = [];
    this.databaseWrites = 0;
    this.batchedWrites = 0;
    this.dbWriteTimestamps = [];
    this.networkRequests = 0;
    this.cachedRequests = 0;
    this.networkTimestamps = [];
  }

  /**
   * Calculate rate per second from timestamps
   */
  private calculateRate(timestamps: number[]): number {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentCount = timestamps.filter((t) => t >= oneSecondAgo).length;
    return recentCount;
  }

  /**
   * Remove timestamps older than 10 seconds to prevent memory leak
   */
  private pruneOldTimestamps(timestamps: number[]): void {
    const cutoff = Date.now() - 10000;
    const firstValidIndex = timestamps.findIndex((t) => t >= cutoff);
    if (firstValidIndex > 0) {
      timestamps.splice(0, firstValidIndex);
    }
  }
}
