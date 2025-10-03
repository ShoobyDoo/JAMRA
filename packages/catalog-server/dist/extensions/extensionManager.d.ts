import { ExtensionHost } from "@jamra/extension-host";
import { CatalogRepository, type ExtensionListOptions, type StoredExtension, type StoredExtensionSourceMetadata, type StoredExtensionUpdateState } from "@jamra/catalog-db";
import { ExtensionStorage } from "./storage.js";
export interface InstallExtensionOptions {
    enabled?: boolean;
    settings?: Record<string, unknown> | null;
    sourceMetadata?: StoredExtensionSourceMetadata | null;
    updateState?: StoredExtensionUpdateState | null;
}
export interface ManagedExtension extends StoredExtension {
    loaded: boolean;
    errors: string[];
}
export declare class ExtensionManager {
    private readonly host;
    private readonly repository?;
    private readonly storage?;
    constructor(host: ExtensionHost, repository?: CatalogRepository | undefined, storage?: ExtensionStorage | undefined);
    initialize(): Promise<void>;
    listExtensions(options?: ExtensionListOptions): ManagedExtension[];
    getExtension(id: string): ManagedExtension | undefined;
    installFromFile(sourcePath: string, options?: InstallExtensionOptions): Promise<ManagedExtension>;
    enableExtension(id: string, settings?: Record<string, unknown> | null): Promise<ManagedExtension>;
    disableExtension(id: string): Promise<ManagedExtension | undefined>;
    uninstallExtension(id: string): Promise<void>;
    updateSettings(id: string, settings: Record<string, unknown> | null): Promise<ManagedExtension>;
    updateExtensionSource(id: string, source: StoredExtensionSourceMetadata | null): void;
    updateExtensionUpdateState(id: string, state: StoredExtensionUpdateState | null): void;
    getDefaultExtensionId(): string | undefined;
    private ensurePersistence;
    private requireExtension;
    private requireEntryPath;
    private toManaged;
}
//# sourceMappingURL=extensionManager.d.ts.map