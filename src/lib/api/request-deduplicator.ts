/**
 * Request Deduplicator
 *
 * Prevents duplicate in-flight API requests by caching promises.
 * If the same request is made multiple times while the first is still pending,
 * all callers will receive the same promise.
 *
 * This is particularly useful for:
 * - Preventing race conditions
 * - Reducing unnecessary network traffic
 * - Improving perceived performance
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

export class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<unknown>>();
  private readonly ttl: number; // Time to live for cached requests in ms

  constructor(options: { ttl?: number } = {}) {
    this.ttl = options.ttl ?? 30000; // Default 30 seconds
  }

  /**
   * Execute a request with deduplication
   * If the same key is already in-flight, returns the existing promise
   */
  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>,
  ): Promise<T> {
    // Check if we have a pending request
    const pending = this.pendingRequests.get(key);

    if (pending) {
      // Check if it's still valid (not expired)
      const age = Date.now() - pending.timestamp;
      if (age < this.ttl) {
        // Return existing promise
        return pending.promise as Promise<T>;
      }

      // Expired, remove it
      this.pendingRequests.delete(key);
    }

    // Create new request
    const promise = requestFn();

    // Store in pending map
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    // Clean up when done (success or failure)
    promise
      .then(() => {
        this.pendingRequests.delete(key);
      })
      .catch(() => {
        this.pendingRequests.delete(key);
      });

    return promise;
  }

  /**
   * Generate a cache key from request parameters
   */
  static makeKey(
    endpoint: string,
    method: string,
    params?: Record<string, unknown>,
  ): string {
    const paramsStr = params ? JSON.stringify(params) : "";
    return `${method}:${endpoint}:${paramsStr}`;
  }

  /**
   * Clear a specific request from cache
   */
  clear(key: string): void {
    this.pendingRequests.delete(key);
  }

  /**
   * Clear all pending requests
   */
  clearAll(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get statistics about pending requests
   */
  getStats(): {
    pendingCount: number;
    oldestAge: number | null;
  } {
    const count = this.pendingRequests.size;
    let oldestAge: number | null = null;

    if (count > 0) {
      const now = Date.now();
      for (const { timestamp } of this.pendingRequests.values()) {
        const age = now - timestamp;
        if (oldestAge === null || age > oldestAge) {
          oldestAge = age;
        }
      }
    }

    return {
      pendingCount: count,
      oldestAge,
    };
  }
}

// Global instance for the application
export const globalDeduplicator = new RequestDeduplicator();
