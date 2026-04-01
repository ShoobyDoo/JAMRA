export interface HtmlRequestOptions {
  params?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
  timeoutMs?: number;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<FetchResponse>;

export interface HtmlScraperClientOptions {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  allowedHosts?: string[];
  maxConcurrent?: number;
  fetcher?: FetchLike;
}

export class HtmlScraperClient {
  private readonly allowedHosts?: Set<string>;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetcher: FetchLike;
  private readonly concurrency: number;
  private activeCount = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly options: HtmlScraperClientOptions) {
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.allowedHosts = options.allowedHosts
      ? new Set(
          options.allowedHosts.map((host) => host.replace(/^https?:\/\//, "")),
        )
      : undefined;
    this.fetcher =
      options.fetcher ??
      ((input, init) => {
        const globalFetch = globalThis.fetch as FetchLike | undefined;
        if (typeof globalFetch !== "function") {
          throw new Error("Global fetch is not available");
        }
        return globalFetch(input, init);
      });
    this.concurrency =
      typeof options.maxConcurrent === "number" && options.maxConcurrent > 0
        ? options.maxConcurrent
        : Number.POSITIVE_INFINITY;
  }

  async get(pathOrUrl: string, options?: HtmlRequestOptions): Promise<string> {
    return this.runWithLimit(() =>
      this.performRequest(pathOrUrl, { method: "GET", ...options }),
    );
  }

  private async performRequest(
    pathOrUrl: string,
    options: HtmlRequestOptions & { method: string },
  ): Promise<string> {
    const url = this.buildUrl(pathOrUrl, options.params);
    this.assertAllowedHost(url);

    const headers = { ...this.defaultHeaders };
    for (const [key, value] of Object.entries(options.headers ?? {})) {
      if (value !== undefined) {
        headers[key] = value;
      }
    }

    const controller =
      typeof options.timeoutMs === "number"
        ? new AbortController()
        : undefined;

    const response = await this.fetcher(url.toString(), {
      method: options.method,
      headers,
      signal: controller?.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Request to ${url.toString()} failed with status ${response.status}`,
      );
    }
    return response.text();
  }

  private buildUrl(
    pathOrUrl: string,
    params?: Record<string, string | undefined>,
  ): URL {
    const url = pathOrUrl.startsWith("http")
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl.replace(/^\//, ""), `${this.options.baseUrl}/`);

    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
    return url;
  }

  private assertAllowedHost(url: URL): void {
    if (!this.allowedHosts || this.allowedHosts.size === 0) {
      return;
    }
    if (!this.allowedHosts.has(url.hostname)) {
      throw new Error(`Blocked request to unsupported host: ${url.hostname}`);
    }
  }

  private async runWithLimit<T>(task: () => Promise<T>): Promise<T> {
    if (!Number.isFinite(this.concurrency)) {
      return task();
    }
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.activeCount < this.concurrency) {
      this.activeCount += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.activeCount += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}
