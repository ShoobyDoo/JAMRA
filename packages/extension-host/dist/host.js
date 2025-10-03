import { CatalogRepository, SqliteExtensionCache, } from "@jamra/catalog-db";
import { createExtensionContext, } from "./context/index.js";
import { importExtension } from "./loader.js";
import { ExtensionLoadError } from "./errors.js";
function mergeSettings(base, overrides, contextOverrides) {
    return {
        ...base,
        ...(contextOverrides?.settings ? contextOverrides.settings : {}),
        ...(overrides ?? {}),
    };
}
function buildInvocationContext(record, options = {}) {
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
    constructor(options = {}) {
        this.options = options;
        this.extensions = new Map();
        this.defaultContext = options.defaultContext;
        this.cacheFactory = options.cacheFactory;
        if (options.database) {
            this.repository = new CatalogRepository(options.database.db);
            if (!this.cacheFactory) {
                this.sharedCache = new SqliteExtensionCache(options.database.db);
            }
        }
    }
    async loadFromFile(filePath, options = {}) {
        const extensionModule = await importExtension(filePath);
        const manifest = extensionModule.manifest;
        if (this.extensions.has(manifest.id)) {
            throw new ExtensionLoadError(`Extension with id ${manifest.id} is already loaded. Unload it before reloading.`);
        }
        const hostContext = this.defaultContext ?? {};
        const loadContext = options.context ?? {};
        const combinedSettings = {
            ...(hostContext.settings ?? {}),
            ...(loadContext.settings ?? {}),
            ...(options.settings ?? {}),
        };
        const contextOptions = {
            ...hostContext,
            ...loadContext,
            settings: combinedSettings,
        };
        if (!contextOptions.cache) {
            contextOptions.cache = this.resolveCache(manifest);
        }
        const context = createExtensionContext(manifest, contextOptions);
        const persistedSettings = { ...context.settings };
        if (extensionModule.handlers.onInitialize) {
            await extensionModule.handlers.onInitialize(context);
        }
        const upsertOptions = {
            entryPath: filePath,
            enabled: true,
            settings: persistedSettings,
        };
        if (options.sourceMetadata !== undefined) {
            upsertOptions.source = options.sourceMetadata;
        }
        if (options.updateState !== undefined) {
            upsertOptions.updateState = options.updateState;
        }
        this.repository?.upsertExtension(manifest, upsertOptions);
        const record = {
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
    resolveCache(manifest) {
        if (this.cacheFactory) {
            return this.cacheFactory(manifest);
        }
        if (this.sharedCache) {
            return this.sharedCache;
        }
        return undefined;
    }
    listManifests() {
        return Array.from(this.extensions.values(), (record) => record.manifest);
    }
    getManifest(id) {
        return this.extensions.get(id)?.manifest;
    }
    getHandlers(id) {
        return this.extensions.get(id)?.handlers;
    }
    listLoadedExtensions() {
        return Array.from(this.extensions.entries()).map(([id, record]) => ({
            id,
            manifest: record.manifest,
            filePath: record.filePath,
        }));
    }
    isLoaded(id) {
        return this.extensions.has(id);
    }
    getBaseSettings(id) {
        const record = this.extensions.get(id);
        return record ? { ...record.baseSettings } : undefined;
    }
    async disableExtension(id) {
        await this.unload(id);
        this.repository?.setExtensionEnabled(id, false);
    }
    async updateExtensionSettings(id, settings) {
        const record = this.ensureExtension(id);
        record.baseSettings = { ...(settings ?? {}) };
        this.repository?.updateExtensionSettings(id, settings);
    }
    async unload(id) {
        const record = this.extensions.get(id);
        if (!record)
            return;
        if (record.handlers.onShutdown) {
            await record.handlers.onShutdown(buildInvocationContext(record, { settings: record.baseSettings }));
        }
        this.extensions.delete(id);
    }
    ensureExtension(id) {
        const record = this.extensions.get(id);
        if (!record) {
            throw new ExtensionLoadError(`Extension ${id} is not loaded.`);
        }
        return record;
    }
    async invokeCatalogue(id, request, options) {
        const record = this.ensureExtension(id);
        const handler = record.handlers.catalogue;
        if (!handler) {
            throw new ExtensionLoadError(`Extension ${id} does not implement catalogue handler.`);
        }
        return handler(buildInvocationContext(record, options), request);
    }
    async invokeSearch(id, request, options) {
        const record = this.ensureExtension(id);
        const handler = record.handlers.search ?? record.handlers.catalogue;
        if (!handler) {
            throw new ExtensionLoadError(`Extension ${id} does not implement search handler.`);
        }
        return handler(buildInvocationContext(record, options), request);
    }
    async invokeMangaDetails(id, request, options) {
        const record = this.ensureExtension(id);
        const handler = record.handlers.fetchMangaDetails;
        if (!handler) {
            throw new ExtensionLoadError(`Extension ${id} does not implement fetchMangaDetails handler.`);
        }
        return handler(buildInvocationContext(record, options), request);
    }
    async invokeChapterList(id, request, options) {
        const record = this.ensureExtension(id);
        const handler = record.handlers.fetchChapters;
        if (!handler) {
            throw new ExtensionLoadError(`Extension ${id} does not implement fetchChapters handler.`);
        }
        return handler(buildInvocationContext(record, options), request);
    }
    async invokeChapterPages(id, request, options) {
        const record = this.ensureExtension(id);
        const handler = record.handlers.fetchChapterPages;
        if (!handler) {
            throw new ExtensionLoadError(`Extension ${id} does not implement fetchChapterPages handler.`);
        }
        return handler(buildInvocationContext(record, options), request);
    }
    async getFilters(id, options) {
        const record = this.ensureExtension(id);
        const handler = record.handlers.getFilters;
        if (!handler)
            return undefined;
        return handler(buildInvocationContext(record, options));
    }
    async getSettingsSchema(id, options) {
        const record = this.ensureExtension(id);
        const handler = record.handlers.getSettingsSchema;
        if (!handler)
            return undefined;
        return handler(buildInvocationContext(record, options));
    }
}
