import type { ExtensionCache } from "@jamra/extension-sdk";

type CacheEntry = {
  expiresAt: number | null;
  value: unknown;
};

export class InMemoryExtensionCache implements ExtensionCache {
  private readonly store = new Map<string, CacheEntry>();

  constructor(private readonly namespacePrefix = "") {}

  private buildKey(namespace: string, key: string) {
    return `${this.namespacePrefix}${namespace}:${key}`;
  }

  async get<T>(namespace: string, key: string): Promise<T | undefined> {
    const entry = this.store.get(this.buildKey(namespace, key));
    if (!entry) return undefined;

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(this.buildKey(namespace, key));
      return undefined;
    }

    return entry.value as T;
  }

  async set<T>(
    namespace: string,
    key: string,
    value: T,
    ttlMs?: number,
  ): Promise<void> {
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    this.store.set(this.buildKey(namespace, key), { value, expiresAt });
  }

  async delete(namespace: string, key: string): Promise<void> {
    this.store.delete(this.buildKey(namespace, key));
  }
}
