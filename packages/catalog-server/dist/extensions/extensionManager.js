import fs from "node:fs";
import path from "node:path";
import { importExtension } from "@jamra/extension-host";
export class ExtensionManager {
    constructor(host, repository, storage) {
        this.host = host;
        this.repository = repository;
        this.storage = storage;
    }
    async initialize() {
        if (!this.repository)
            return;
        const installed = this.repository.listExtensions({ status: "enabled" });
        for (const extension of installed) {
            const entryPath = extension.entryPath;
            if (!entryPath) {
                this.repository.setExtensionEnabled(extension.id, false);
                continue;
            }
            if (!fs.existsSync(entryPath)) {
                console.warn(`Extension bundle missing at ${entryPath}; disabling ${extension.id}.`);
                this.repository.setExtensionEnabled(extension.id, false);
                continue;
            }
            try {
                await this.host.loadFromFile(entryPath, {
                    settings: extension.settings ?? undefined,
                });
            }
            catch (error) {
                console.error(`Failed to load extension ${extension.id} during startup.`, error);
            }
        }
    }
    listExtensions(options = {}) {
        if (!this.repository)
            return [];
        const rows = this.repository.listExtensions(options);
        return rows.map((row) => this.toManaged(row));
    }
    getExtension(id) {
        if (!this.repository)
            return undefined;
        const row = this.repository.getExtension(id);
        if (!row)
            return undefined;
        return this.toManaged(row);
    }
    async installFromFile(sourcePath, options = {}) {
        const absolutePath = path.resolve(sourcePath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Extension bundle not found at ${absolutePath}`);
        }
        this.ensurePersistence();
        const extensionModule = await importExtension(absolutePath);
        const manifest = extensionModule.manifest;
        const existing = this.repository.getExtension(manifest.id);
        const targetSettings = options.settings ?? existing?.settings ?? null;
        const storedPath = await this.storage.save(absolutePath, manifest);
        if (this.host.isLoaded(manifest.id)) {
            await this.host.unload(manifest.id);
        }
        const upsertOptions = {
            entryPath: storedPath,
            enabled: options.enabled ?? true,
            settings: targetSettings,
        };
        if (options.sourceMetadata !== undefined) {
            upsertOptions.source = options.sourceMetadata;
        }
        if (options.updateState !== undefined) {
            upsertOptions.updateState = options.updateState;
        }
        if (options.enabled === false) {
            upsertOptions.enabled = false;
            this.repository.upsertExtension(manifest, upsertOptions);
        }
        else {
            await this.host.loadFromFile(storedPath, {
                settings: targetSettings ?? undefined,
                sourceMetadata: options.sourceMetadata,
                updateState: options.updateState,
            });
        }
        return this.getExtension(manifest.id);
    }
    async enableExtension(id, settings) {
        this.ensurePersistence();
        const record = this.requireExtension(id);
        const entryPath = this.requireEntryPath(record);
        const desiredSettings = settings ?? record.settings ?? null;
        if (this.host.isLoaded(id)) {
            if (settings !== undefined) {
                await this.host.updateExtensionSettings(id, settings);
            }
            this.repository.setExtensionEnabled(id, true);
            return this.getExtension(id);
        }
        await this.host.loadFromFile(entryPath, {
            settings: desiredSettings ?? undefined,
        });
        return this.getExtension(id);
    }
    async disableExtension(id) {
        this.ensurePersistence();
        await this.host.disableExtension(id);
        return this.getExtension(id);
    }
    async uninstallExtension(id) {
        this.ensurePersistence();
        if (this.host.isLoaded(id)) {
            await this.host.disableExtension(id);
        }
        else {
            this.repository.setExtensionEnabled(id, false);
        }
        this.repository.removeExtension(id);
        await this.storage.remove(id);
    }
    async updateSettings(id, settings) {
        this.ensurePersistence();
        if (this.host.isLoaded(id)) {
            await this.host.updateExtensionSettings(id, settings);
        }
        else {
            this.repository.updateExtensionSettings(id, settings);
        }
        return this.getExtension(id);
    }
    updateExtensionSource(id, source) {
        this.ensurePersistence();
        this.repository.updateExtensionSourceMetadata(id, source);
    }
    updateExtensionUpdateState(id, state) {
        this.ensurePersistence();
        this.repository.updateExtensionUpdateState(id, state);
    }
    getDefaultExtensionId() {
        const loaded = this.host.listLoadedExtensions();
        if (loaded.length > 0) {
            return loaded[0].id;
        }
        if (!this.repository)
            return undefined;
        const enabled = this.repository.listExtensions({ status: "enabled" });
        return enabled[0]?.id;
    }
    ensurePersistence() {
        if (!this.repository || !this.storage) {
            throw new Error("Persistent extension storage is not available.");
        }
    }
    requireExtension(id) {
        if (!this.repository) {
            throw new Error("Extension repository not available.");
        }
        const extension = this.repository.getExtension(id);
        if (!extension) {
            throw new Error(`Extension ${id} is not installed.`);
        }
        return extension;
    }
    requireEntryPath(extension) {
        if (!extension.entryPath) {
            throw new Error(`Extension ${extension.id} does not have a stored bundle path.`);
        }
        if (!fs.existsSync(extension.entryPath)) {
            throw new Error(`Extension bundle missing at ${extension.entryPath}`);
        }
        return extension.entryPath;
    }
    toManaged(extension) {
        const loaded = this.host.isLoaded(extension.id);
        const errors = [];
        if (!extension.entryPath) {
            errors.push("Extension bundle path is not recorded.");
        }
        else if (!fs.existsSync(extension.entryPath)) {
            errors.push(`Bundle missing at ${extension.entryPath}`);
        }
        else if (extension.enabled && !loaded) {
            errors.push("Extension is enabled but not loaded.");
        }
        return {
            ...extension,
            settings: extension.settings ? { ...extension.settings } : undefined,
            loaded,
            errors,
        };
    }
}
