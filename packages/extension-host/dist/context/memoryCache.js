export class InMemoryExtensionCache {
    constructor(namespacePrefix = "") {
        this.namespacePrefix = namespacePrefix;
        this.store = new Map();
    }
    buildKey(namespace, key) {
        return `${this.namespacePrefix}${namespace}:${key}`;
    }
    async get(namespace, key) {
        const entry = this.store.get(this.buildKey(namespace, key));
        if (!entry)
            return undefined;
        if (entry.expiresAt && entry.expiresAt <= Date.now()) {
            this.store.delete(this.buildKey(namespace, key));
            return undefined;
        }
        return entry.value;
    }
    async set(namespace, key, value, ttlMs) {
        const expiresAt = ttlMs ? Date.now() + ttlMs : null;
        this.store.set(this.buildKey(namespace, key), { value, expiresAt });
    }
    async delete(namespace, key) {
        this.store.delete(this.buildKey(namespace, key));
    }
}
