import { ConsoleExtensionLogger } from "./defaultLogger.js";
import { InMemoryExtensionCache } from "./memoryCache.js";
import { FetchExtensionHttpClient, } from "./httpClient.js";
export function createExtensionContext(manifest, options = {}) {
    const logger = options.logger instanceof ConsoleExtensionLogger
        ? options.logger
        : (options.logger ?? new ConsoleExtensionLogger(manifest.id));
    const cache = options.cache ?? new InMemoryExtensionCache(`${manifest.id}-`);
    const http = "request" in (options.http ?? {})
        ? options.http
        : new FetchExtensionHttpClient(options.http);
    const runtime = options.runtime ?? {
        platform: typeof process !== "undefined" && "platform" in process
            ? process.platform
            : "unknown",
        version: typeof process !== "undefined" && "version" in process
            ? process.version
            : "0.0.0",
    };
    return {
        logger,
        cache,
        http,
        settings: options.settings ?? {},
        runtime,
    };
}
