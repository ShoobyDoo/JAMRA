import type {
  CatalogueRequest,
  CatalogueResponse,
  ChapterListRequest,
  ChapterPages,
  ChapterPagesChunk,
  ChapterPagesChunkRequest,
  ChapterPagesRequest,
  ExtensionContext,
  ExtensionHandlers,
  ExtensionManifest,
  ExtensionModule,
  ExtensionSettingsSchema,
  ExtensionFilters,
  MangaDetails,
  MangaDetailsRequest,
} from "@jamra/extension-sdk";
import {
  ExtensionRepository,
  SqliteExtensionCache,
  type CatalogDatabase,
  type StoredExtensionSourceMetadata,
  type StoredExtensionUpdateState,
} from "@jamra/catalog-db";
import {
  createExtensionContext,
  type CreateExtensionContextOptions,
} from "./context/index.js";
import { importExtension } from "./loader.js";
import { ExtensionLoadError } from "./errors.js";

export interface ExtensionHostOptions {
  defaultContext?: CreateExtensionContextOptions;
  database?: CatalogDatabase;
  cacheFactory?: (manifest: ExtensionManifest) => ExtensionContext["cache"];
}

export interface LoadExtensionOptions {
  context?: CreateExtensionContextOptions;
  settings?: Record<string, unknown>;
  sourceMetadata?: StoredExtensionSourceMetadata | null;
  updateState?: StoredExtensionUpdateState | null;
}

export interface ExtensionInvocationOptions {
  settings?: Record<string, unknown>;
  contextOverrides?: Partial<
    Pick<ExtensionContext, "logger" | "cache" | "http" | "runtime" | "settings">
  >;
}

interface LoadedExtensionRecord {
  module: ExtensionModule;
  manifest: ExtensionManifest;
  handlers: ExtensionHandlers;
  filePath: string;
  baseContextComponents: {
    logger: ExtensionContext["logger"];
    cache: ExtensionContext["cache"];
    http: ExtensionContext["http"];
    runtime: ExtensionContext["runtime"];
  };
  baseSettings: Record<string, unknown>;
}

function mergeSettings(
  base: Record<string, unknown>,
  overrides?: Record<string, unknown>,
  contextOverrides?: ExtensionInvocationOptions["contextOverrides"],
) {
  return {
    ...base,
    ...(contextOverrides?.settings ? contextOverrides.settings : {}),
    ...(overrides ?? {}),
  };
}

function buildInvocationContext(
  record: LoadedExtensionRecord,
  options: ExtensionInvocationOptions = {},
): ExtensionContext {
  const { baseContextComponents, baseSettings } = record;
  const contextOverrides = options.contextOverrides;

  return {
    logger: contextOverrides?.logger ?? baseContextComponents.logger,
    cache: contextOverrides?.cache ?? baseContextComponents.cache,
    http: contextOverrides?.http ?? baseContextComponents.http,
    runtime: contextOverrides?.runtime ?? baseContextComponents.runtime,
    settings: mergeSettings(baseSettings, options.settings, contextOverrides),
  };
}

export class ExtensionHost {
  private readonly extensions = new Map<string, LoadedExtensionRecord>();
  private readonly repository?: ExtensionRepository;
  private readonly cacheFactory?: (
    manifest: ExtensionManifest,
  ) => ExtensionContext["cache"];
  private readonly defaultContext?: CreateExtensionContextOptions;
  private sharedCache?: ExtensionContext["cache"];

  constructor(private readonly options: ExtensionHostOptions = {}) {
    this.defaultContext = options.defaultContext;
    this.cacheFactory = options.cacheFactory;
    if (options.database) {
      this.repository = new ExtensionRepository(options.database.db);
      if (!this.cacheFactory) {
        this.sharedCache = new SqliteExtensionCache(options.database.db);
      }
    }
  }

  async loadFromFile(filePath: string, options: LoadExtensionOptions = {}) {
    const extensionModule = await importExtension(filePath);
    const manifest = extensionModule.manifest;

    if (this.extensions.has(manifest.id)) {
      throw new ExtensionLoadError(
        `Extension with id ${manifest.id} is already loaded. Unload it before reloading.`,
      );
    }

    const hostContext = this.defaultContext ?? {};
    const loadContext = options.context ?? {};

    const combinedSettings = {
      ...(hostContext.settings ?? {}),
      ...(loadContext.settings ?? {}),
      ...(options.settings ?? {}),
    };

    const contextOptions: CreateExtensionContextOptions = {
      ...hostContext,
      ...loadContext,
      settings: combinedSettings,
    };

    if (!contextOptions.cache) {
      contextOptions.cache = this.resolveCache(manifest);
    }

    const context = createExtensionContext(manifest, contextOptions);
    const persistedSettings = { ...context.settings } as Record<
      string,
      unknown
    >;

    if (extensionModule.handlers.onInitialize) {
      await extensionModule.handlers.onInitialize(context);
    }

    const upsertOptions: Parameters<ExtensionRepository["upsertExtension"]>[1] = {
      entryPath: filePath,
      enabled: true,
      settings: persistedSettings,
    };

    if (options.sourceMetadata !== undefined && options.sourceMetadata !== null) {
      upsertOptions.sourceMetadata = options.sourceMetadata;
    }

    if (options.updateState !== undefined && options.updateState !== null) {
      upsertOptions.updateState = options.updateState;
    }

    this.repository?.upsertExtension(manifest, upsertOptions);

    const record: LoadedExtensionRecord = {
      module: extensionModule,
      manifest,
      handlers: extensionModule.handlers,
      filePath,
      baseContextComponents: {
        logger: context.logger,
        cache: context.cache,
        http: context.http,
        runtime: context.runtime,
      },
      baseSettings: persistedSettings,
    };

    this.extensions.set(manifest.id, record);

    return { manifest, filePath };
  }

  private resolveCache(manifest: ExtensionManifest) {
    if (this.cacheFactory) {
      return this.cacheFactory(manifest);
    }

    if (this.sharedCache) {
      return this.sharedCache;
    }

    return undefined;
  }

  listManifests(): ExtensionManifest[] {
    return Array.from(this.extensions.values(), (record) => record.manifest);
  }

  getManifest(id: string): ExtensionManifest | undefined {
    return this.extensions.get(id)?.manifest;
  }

  getHandlers(id: string): ExtensionHandlers | undefined {
    return this.extensions.get(id)?.handlers;
  }

  listLoadedExtensions(): Array<{
    id: string;
    manifest: ExtensionManifest;
    filePath: string;
  }> {
    return Array.from(this.extensions.entries()).map(([id, record]) => ({
      id,
      manifest: record.manifest,
      filePath: record.filePath,
    }));
  }

  isLoaded(id: string): boolean {
    return this.extensions.has(id);
  }

  getBaseSettings(id: string): Record<string, unknown> | undefined {
    const record = this.extensions.get(id);
    return record ? { ...record.baseSettings } : undefined;
  }

  async disableExtension(id: string): Promise<void> {
    await this.unload(id);
    this.repository?.setExtensionEnabled(id, false);
  }

  async updateExtensionSettings(
    id: string,
    settings: Record<string, unknown> | null,
  ): Promise<void> {
    const record = this.ensureExtension(id);
    record.baseSettings = { ...(settings ?? {}) };
    this.repository?.updateExtensionSettings(id, settings);
  }

  async unload(id: string): Promise<void> {
    const record = this.extensions.get(id);
    if (!record) return;

    if (record.handlers.onShutdown) {
      await record.handlers.onShutdown(
        buildInvocationContext(record, { settings: record.baseSettings }),
      );
    }

    this.extensions.delete(id);
  }

  private ensureExtension(id: string): LoadedExtensionRecord {
    const record = this.extensions.get(id);
    if (!record) {
      throw new ExtensionLoadError(`Extension ${id} is not loaded.`);
    }
    return record;
  }

  async invokeCatalogue(
    id: string,
    request: CatalogueRequest,
    options?: ExtensionInvocationOptions,
  ): Promise<CatalogueResponse> {
    const record = this.ensureExtension(id);
    const handler = record.handlers.catalogue;
    if (!handler) {
      throw new ExtensionLoadError(
        `Extension ${id} does not implement catalogue handler.`,
      );
    }
    return handler(buildInvocationContext(record, options), request);
  }

  async invokeSearch(
    id: string,
    request: CatalogueRequest,
    options?: ExtensionInvocationOptions,
  ): Promise<CatalogueResponse> {
    const record = this.ensureExtension(id);
    const handler = record.handlers.search ?? record.handlers.catalogue;
    if (!handler) {
      throw new ExtensionLoadError(
        `Extension ${id} does not implement search handler.`,
      );
    }
    return handler(buildInvocationContext(record, options), request);
  }

  async invokeMangaDetails(
    id: string,
    request: MangaDetailsRequest,
    options?: ExtensionInvocationOptions,
  ): Promise<MangaDetails> {
    const record = this.ensureExtension(id);
    const handler = record.handlers.fetchMangaDetails;
    if (!handler) {
      throw new ExtensionLoadError(
        `Extension ${id} does not implement fetchMangaDetails handler.`,
      );
    }
    return handler(buildInvocationContext(record, options), request);
  }

  async invokeChapterList(
    id: string,
    request: ChapterListRequest,
    options?: ExtensionInvocationOptions,
  ): Promise<MangaDetails["chapters"]> {
    const record = this.ensureExtension(id);
    const handler = record.handlers.fetchChapters;
    if (!handler) {
      throw new ExtensionLoadError(
        `Extension ${id} does not implement fetchChapters handler.`,
      );
    }
    return handler(buildInvocationContext(record, options), request);
  }

  async invokeChapterPages(
    id: string,
    request: ChapterPagesRequest,
    options?: ExtensionInvocationOptions,
  ): Promise<ChapterPages> {
    const record = this.ensureExtension(id);
    const handler = record.handlers.fetchChapterPages;
    if (!handler) {
      throw new ExtensionLoadError(
        `Extension ${id} does not implement fetchChapterPages handler.`,
      );
    }
    return handler(buildInvocationContext(record, options), request);
  }

  async invokeChapterPagesChunk(
    id: string,
    request: ChapterPagesChunkRequest,
    options?: ExtensionInvocationOptions,
  ): Promise<ChapterPagesChunk> {
    const record = this.ensureExtension(id);
    const handler = record.handlers.fetchChapterPagesChunk;
    if (handler) {
      return handler(buildInvocationContext(record, options), request);
    }

    const full = await this.invokeChapterPages(
      id,
      {
        mangaId: request.mangaId,
        chapterId: request.chapterId,
        signal: request.signal,
      },
      options,
    );
    const { chunk, chunkSize } = request;
    const startIndex = chunk * chunkSize;
    const endIndex = startIndex + chunkSize;
    const totalPages = full.pages.length;
    const totalChunks = Math.max(1, Math.ceil(totalPages / chunkSize));

    const slice = full.pages.slice(startIndex, endIndex).map((page, index) => ({
      ...page,
      index: startIndex + index,
    }));

    return {
      chapterId: full.chapterId,
      mangaId: full.mangaId,
      chunk,
      chunkSize,
      totalChunks,
      totalPages,
      pages: slice,
      hasMore: endIndex < totalPages,
    };
  }

  async getFilters(
    id: string,
    options?: ExtensionInvocationOptions,
  ): Promise<ExtensionFilters | undefined> {
    const record = this.ensureExtension(id);
    const handler = record.handlers.getFilters;
    if (!handler) return undefined;
    return handler(buildInvocationContext(record, options));
  }

  async getSettingsSchema(
    id: string,
    options?: ExtensionInvocationOptions,
  ): Promise<ExtensionSettingsSchema | undefined> {
    const record = this.ensureExtension(id);
    const handler = record.handlers.getSettingsSchema;
    if (!handler) return undefined;
    return handler(buildInvocationContext(record, options));
  }
}
