export interface ExtensionLogger {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}
export interface ExtensionCache {
    get<T>(namespace: string, key: string): Promise<T | undefined>;
    set<T>(namespace: string, key: string, value: T, ttlMs?: number): Promise<void>;
    delete(namespace: string, key: string): Promise<void>;
}
export interface HttpResponse<T = unknown> {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: T;
}
export interface HttpRequestOptions {
    method?: string;
    headers?: Record<string, string>;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    signal?: AbortSignal;
    timeoutMs?: number;
}
export interface ExtensionHttpClient {
    request<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
}
export interface ExtensionContext {
    logger: ExtensionLogger;
    cache: ExtensionCache;
    http: ExtensionHttpClient;
    settings: Record<string, unknown>;
    runtime: {
        platform: "win32" | "darwin" | "linux" | "web" | "unknown";
        version: string;
    };
}
//# sourceMappingURL=context.d.ts.map