import type Database from "better-sqlite3";
import type { ExtensionCache } from "@jamra/extension-sdk";
export declare class SqliteExtensionCache implements ExtensionCache {
    private readonly db;
    private readonly getStmt;
    private readonly setStmt;
    private readonly deleteStmt;
    private readonly cleanupExpiredStmt;
    constructor(db: Database.Database);
    get<T>(namespace: string, key: string): Promise<T | undefined>;
    set<T>(namespace: string, key: string, value: T, ttlMs?: number): Promise<void>;
    delete(namespace: string, key: string): Promise<void>;
    cleanupExpired(): Promise<number>;
}
//# sourceMappingURL=sqliteExtensionCache.d.ts.map