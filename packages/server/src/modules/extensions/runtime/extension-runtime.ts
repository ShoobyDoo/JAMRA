import { createRequire } from "node:module";
import path from "node:path";
import type {
  ExtensionLoader,
  ExtensionRecord,
  ExtensionRuntime,
  LoadedExtensionSource,
} from "../extensions.types.js";
import type { ExtensionContext, ExtensionModule } from "@jamra/extension-sdk";
import type { HttpClient } from "../../../shared/http/http-client.js";
import type { Logger } from "../../../shared/logger.js";
import { ValidationError } from "../../../shared/errors.js";

interface ExtensionRuntimeOptions {
  env: "development" | "production" | "test";
  defaultTimeoutMs: number;
  httpClient: HttpClient;
  logger: Logger;
  allowNetworkHosts: string[];
}

interface LoadedExtension {
  source: LoadedExtensionSource;
  module: ExtensionModule;
}

type ExtensionSettingsValues = ExtensionContext["settings"];

export class DefaultExtensionRuntime implements ExtensionRuntime {
  private readonly modules = new Map<string, LoadedExtension>();
  private readonly settingsStore = new Map<string, ExtensionSettingsValues>();
  private readonly allowedHosts: Set<string>;
  private readonly isDevMode: boolean;

  constructor(
    private readonly loader: ExtensionLoader,
    private readonly options: ExtensionRuntimeOptions,
  ) {
    this.allowedHosts = new Set(
      options.allowNetworkHosts.map((host) => host.toLowerCase()),
    );
    this.isDevMode = options.env === "development";
  }

  async initialise(record: ExtensionRecord): Promise<void> {
    const existing = this.modules.get(record.id);
    if (existing) {
      return;
    }

    const source = await this.loader.loadSource(record);
    const module = await this.instantiateModule(record, source);

    await this.invokeLifecycle(record, module, "init", undefined);
    this.modules.set(record.id, { source, module });
  }

  async execute<TPayload = unknown, TResult = unknown>(
    record: ExtensionRecord,
    lifecycleMethod: keyof ExtensionModule,
    payload: TPayload,
  ): Promise<TResult> {
    const loaded = await this.ensureLoaded(record);
    return this.invokeLifecycle<TPayload, TResult>(
      record,
      loaded.module,
      lifecycleMethod,
      payload,
    );
  }

  async dispose(record: ExtensionRecord): Promise<void> {
    const loaded = this.modules.get(record.id);
    if (!loaded) {
      return;
    }

    await this.invokeLifecycle(record, loaded.module, "dispose", undefined);
    await this.loader.unload(record);
    this.modules.delete(record.id);
  }

  private async ensureLoaded(
    record: ExtensionRecord,
  ): Promise<LoadedExtension> {
    const loaded = this.modules.get(record.id);
    if (loaded) {
      return loaded;
    }
    await this.initialise(record);
    const next = this.modules.get(record.id);
    if (!next) {
      throw new ValidationError(`Extension ${record.slug} failed to load`);
    }
    return next;
  }

  private shouldLogLifecycleMethod(method: keyof ExtensionModule): boolean {
    if (!this.isDevMode) {
      return false;
    }
    const methodsToLog: Array<keyof ExtensionModule> = [
      "search",
      "getMangaDetails",
      "getChapters",
      "getPages",
    ];
    return methodsToLog.includes(method);
  }

  private createContext(record: ExtensionRecord): ExtensionContext {
    const baseLogger = this.options.logger;
    const extensionMeta = {
      extensionId: record.id,
      extensionSlug: record.slug,
      extensionVersion: record.version,
    } as const;

    return {
      settings: this.getSettings(record.id),
      http: {
        get: async (url, options) => {
          this.assertHostAllowed(url);
          return this.options.httpClient.get(url, {
            headers: options?.headers,
            timeoutMs: options?.timeoutMs,
          });
        },
      },
      logger: {
        info: (message: string, meta?: Record<string, unknown>): void => {
          baseLogger.info(message, { ...extensionMeta, ...meta });
        },
        warn: (message: string, meta?: Record<string, unknown>): void => {
          baseLogger.warn(message, { ...extensionMeta, ...meta });
        },
        error: (message: string, meta?: Record<string, unknown>): void => {
          baseLogger.error(message, { ...extensionMeta, ...meta });
        },
        debug: (message: string, meta?: Record<string, unknown>): void => {
          baseLogger.debug(message, { ...extensionMeta, ...meta });
        },
      },
    };
  }

  private async invokeLifecycle<TPayload, TResult>(
    record: ExtensionRecord,
    module: ExtensionModule,
    lifecycleMethod: keyof ExtensionModule,
    payload: TPayload,
  ): Promise<TResult> {
    const fn = module[lifecycleMethod];
    if (typeof fn !== "function") {
      if (lifecycleMethod === "init" || lifecycleMethod === "dispose") {
        return undefined as TResult;
      }
      throw new ValidationError(
        `Extension ${record.slug} does not implement ${String(
          lifecycleMethod,
        )}`,
      );
    }

    const context = this.createContext(record);

    let args: unknown[];
    switch (lifecycleMethod) {
      case "init":
      case "dispose":
        args = [context];
        break;
      case "getSettings":
        args = [this.getSettings(record.id), context];
        break;
      case "onSettingsChange":
        if (payload && typeof payload === "object") {
          this.settingsStore.set(
            record.id,
            Object.freeze({ ...(payload as ExtensionSettingsValues) }) as ExtensionSettingsValues,
          );
        }
        args = [payload, context];
        break;
      default:
        args = [payload, context];
        break;
    }

    // Auto-logging in dev mode
    const shouldLog = this.shouldLogLifecycleMethod(lifecycleMethod);
    const startTime = shouldLog ? Date.now() : 0;

    if (shouldLog) {
      const safePayload = this.summarizeForLog(payload);
      this.options.logger.debug(
        `Extension lifecycle: ${String(lifecycleMethod)} - start`,
        {
          extensionId: record.id,
          extensionSlug: record.slug,
          method: String(lifecycleMethod),
          payload: safePayload,
        },
      );
    }

    const result = (fn as (...args: unknown[]) => Promise<TResult> | TResult)(
      ...args,
    );
    const finalResult = await this.withTimeout(result);

    if (shouldLog) {
      const duration = Date.now() - startTime;
      const safeResult = this.summarizeForLog(finalResult);
      this.options.logger.debug(
        `Extension lifecycle: ${String(lifecycleMethod)} - complete`,
        {
          extensionId: record.id,
          extensionSlug: record.slug,
          method: String(lifecycleMethod),
          durationMs: duration,
          result: safeResult,
        },
      );
    }

    return finalResult;
  }

  private async withTimeout<TResult>(
    promiseLike: Promise<TResult> | TResult,
  ): Promise<TResult> {
    const timeoutMs = this.options.defaultTimeoutMs;
    if (!timeoutMs || timeoutMs <= 0) {
      return Promise.resolve(promiseLike as TResult);
    }

    const execution = Promise.resolve(promiseLike as TResult);
    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ValidationError("Extension execution timed out"));
      }, timeoutMs);

      execution
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private summarizeForLog(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "string") {
      const maxLength = 200;
      return value.length > maxLength
        ? `${value.slice(0, maxLength)}… (+${value.length - maxLength} chars)`
        : value;
    }

    if (typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      const maxItems = 5;
      const preview = value
        .slice(0, maxItems)
        .map((item) => this.summarizeForLog(item, depth + 1));
      if (value.length > maxItems) {
        preview.push(`… (+${value.length - maxItems} more)`);
      }
      return preview;
    }

    if (depth >= 2) {
      return "[Object]";
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const maxEntries = 8;
    const summarizedEntries = entries
      .slice(0, maxEntries)
      .reduce<Record<string, unknown>>((acc, [key, entryValue]) => {
        acc[key] = this.summarizeForLog(entryValue, depth + 1);
        return acc;
      }, {});

    if (entries.length > maxEntries) {
      summarizedEntries.__truncated = `+${entries.length - maxEntries} more keys`;
    }

    return summarizedEntries;
  }

  private getSettings(extensionId: string): ExtensionSettingsValues {
    const existing = this.settingsStore.get(extensionId);
    if (existing) {
      return existing;
    }
    const initial = Object.freeze({}) as ExtensionSettingsValues;
    this.settingsStore.set(extensionId, initial);
    return initial;
  }

  private assertHostAllowed(url: string): void {
    if (this.allowedHosts.size === 0) {
      return;
    }
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!this.allowedHosts.has(host)) {
      throw new ValidationError(`Host ${host} is not allowlisted for extensions runtime`);
    }
  }

  private async instantiateModule(
    record: ExtensionRecord,
    source: LoadedExtensionSource,
  ): Promise<ExtensionModule> {
    const require = createRequire(source.entryPath);
    const exports: Record<string, unknown> = {};
    const module = { exports };
    const dirname = path.dirname(source.entryPath);
    const filename = source.entryPath;

    try {
      const evaluator = new Function(
        "exports",
        "module",
        "require",
        "__filename",
        "__dirname",
        source.code,
      );
      evaluator(exports, module, require, filename, dirname);
    } catch (error) {
      throw new ValidationError(
        `Failed to load extension ${record.slug}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const exportedModule =
      (module.exports as unknown as Record<string, unknown> | undefined) ??
      (exports as unknown as Record<string, unknown> | undefined);

    if (!exportedModule || typeof exportedModule !== "object") {
      throw new ValidationError(
        `Extension ${record.slug} did not export a module object`,
      );
    }

    const moduleExport =
      (exportedModule as unknown as { default?: Record<string, unknown> }).default ??
      exportedModule;

    if (!moduleExport || typeof moduleExport !== "object") {
      throw new ValidationError(
        `Extension ${record.slug} is missing a default export`,
      );
    }

    return this.attachManifest(record, moduleExport);
  }

  private attachManifest(
    record: ExtensionRecord,
    moduleExport: Record<string, unknown>,
  ): ExtensionModule {
    if (!("manifest" in moduleExport) || !moduleExport["manifest"]) {
      return Object.assign({}, moduleExport, {
        manifest: record.manifest,
      }) as unknown as ExtensionModule;
    }
    return moduleExport as unknown as ExtensionModule;
  }
}

export const createExtensionRuntime = (
  loader: ExtensionLoader,
  options: ExtensionRuntimeOptions,
): ExtensionRuntime => {
  return new DefaultExtensionRuntime(loader, options);
};
