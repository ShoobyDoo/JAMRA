function toStoredValue(value) {
    return JSON.stringify({ v: value });
}
function fromStoredValue(raw) {
    return JSON.parse(raw).v;
}
export class SqliteExtensionCache {
    constructor(db) {
        this.db = db;
        this.getStmt = this.db.prepare(`SELECT value, expires_at FROM extension_cache WHERE namespace = @namespace AND cache_key = @cache_key`);
        this.setStmt = this.db.prepare(`INSERT INTO extension_cache (namespace, cache_key, value, expires_at, updated_at)
       VALUES (@namespace, @cache_key, @value, @expires_at, @updated_at)
       ON CONFLICT(namespace, cache_key) DO UPDATE SET
         value = excluded.value,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`);
        this.deleteStmt = this.db.prepare(`DELETE FROM extension_cache WHERE namespace = @namespace AND cache_key = @cache_key`);
        this.cleanupExpiredStmt = this.db.prepare(`DELETE FROM extension_cache WHERE expires_at IS NOT NULL AND expires_at <= @now`);
    }
    async get(namespace, key) {
        const row = this.getStmt.get({ namespace, cache_key: key });
        if (!row)
            return undefined;
        if (row.expires_at && row.expires_at <= Date.now()) {
            this.deleteStmt.run({ namespace, cache_key: key });
            return undefined;
        }
        return fromStoredValue(row.value);
    }
    async set(namespace, key, value, ttlMs) {
        this.setStmt.run({
            namespace,
            cache_key: key,
            value: toStoredValue(value),
            expires_at: ttlMs ? Date.now() + ttlMs : null,
            updated_at: Date.now(),
        });
    }
    async delete(namespace, key) {
        this.deleteStmt.run({ namespace, cache_key: key });
    }
    async cleanupExpired() {
        const result = this.cleanupExpiredStmt.run({ now: Date.now() });
        return result.changes ?? 0;
    }
}
