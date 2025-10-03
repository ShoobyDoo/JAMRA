import type { ExtensionCache } from "@jamra/extension-sdk";
export declare class InMemoryExtensionCache implements ExtensionCache {
    private readonly namespacePrefix;
    private readonly store;
    constructor(namespacePrefix?: string);
    private buildKey;
    get<T>(namespace: string, key: string): Promise<T | undefined>;
    set<T>(namespace: string, key: string, value: T, ttlMs?: number): Promise<void>;
    delete(namespace: string, key: string): Promise<void>;
}
//# sourceMappingURL=memoryCache.d.ts.map