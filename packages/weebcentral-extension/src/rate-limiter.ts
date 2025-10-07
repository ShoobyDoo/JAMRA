interface RateLimiterConfig {
  requestsPerSecond: number;
  maxConcurrentImages?: number;
}

export class RateLimiter {
  private queue: Array<() => void> = [];
  private activeRequests = 0;
  private lastRequestTime = 0;
  private readonly minDelay: number;
  private readonly maxConcurrentImages: number;

  constructor(config: RateLimiterConfig) {
    this.minDelay = 1000 / config.requestsPerSecond;
    this.maxConcurrentImages = config.maxConcurrentImages || 10;
  }

  async throttle<T>(fn: () => Promise<T>, isImage = false): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;

          if (timeSinceLastRequest < this.minDelay) {
            await this.delay(this.minDelay - timeSinceLastRequest);
          }

          this.lastRequestTime = Date.now();
          this.activeRequests++;

          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          this.processQueue();
        }
      };

      // Images can run concurrently up to maxConcurrentImages
      if (isImage && this.activeRequests < this.maxConcurrentImages) {
        execute();
      } else if (!isImage) {
        // API requests are strictly rate limited
        this.queue.push(execute);
        this.processQueue();
      } else {
        // Image queue when at capacity
        this.queue.push(execute);
      }
    });
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.activeRequests === 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
