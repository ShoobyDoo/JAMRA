import Database from "better-sqlite3";
import type { ExtensionManifest } from "@jamra/extension-sdk";
export interface CatalogDatabaseOptions {
    filePath?: string;
    dataDir?: string;
}
export interface InitializedDatabase {
    db: Database.Database;
    manifest?: ExtensionManifest;
}
export declare class CatalogDatabase {
    private connection?;
    private filePath;
    constructor(options?: CatalogDatabaseOptions);
    connect(): Database.Database;
    get db(): Database.Database;
    close(): void;
    get path(): string;
}
//# sourceMappingURL=database.d.ts.map