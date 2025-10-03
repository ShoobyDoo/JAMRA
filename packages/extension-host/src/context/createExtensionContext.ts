import type { ExtensionContext, ExtensionManifest } from "@jamra/extension-sdk";
import { ConsoleExtensionLogger } from "./defaultLogger.js";
import { InMemoryExtensionCache } from "./memoryCache.js";
import {
  FetchExtensionHttpClient,
  type FetchHttpClientOptions,
} from "./httpClient.js";

export interface CreateExtensionContextOptions {
  logger?: ExtensionContext["logger"];
  cache?: ExtensionContext["cache"];
  http?: ExtensionContext["http"] | FetchHttpClientOptions;
  settings?: Record<string, unknown>;
  runtime?: ExtensionContext["runtime"];
}

export function createExtensionContext(
  manifest: ExtensionManifest,
  options: CreateExtensionContextOptions = {},
): ExtensionContext {
  const logger =
    options.logger instanceof ConsoleExtensionLogger
      ? options.logger
      : (options.logger ?? new ConsoleExtensionLogger(manifest.id));

  const cache = options.cache ?? new InMemoryExtensionCache(`${manifest.id}-`);

  const http =
    "request" in (options.http ?? {})
      ? (options.http as ExtensionContext["http"])
      : new FetchExtensionHttpClient(
          options.http as FetchHttpClientOptions | undefined,
        );

  const runtime = options.runtime ?? {
    platform:
      typeof process !== "undefined" && "platform" in process
        ? (process.platform as ExtensionContext["runtime"]["platform"])
        : "unknown",
    version:
      typeof process !== "undefined" && "version" in process
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
