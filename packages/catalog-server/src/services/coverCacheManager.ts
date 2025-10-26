import type { CoverCacheRepository, CoverCacheRecord } from "@jamra/catalog-db";

export interface CoverCacheSettings {
  enabled: boolean;
  ttlMs: number;
  maxEntries: number;
  fetchTimeoutMs?: number;
}

export interface CachedCoverPayload {
  dataUrl: string;
  sourceUrl: string;
  updatedAt: number;
  expiresAt?: number;
  mimeType?: string;
  bytes?: number;
}

const DEFAULT_SETTINGS: CoverCacheSettings = {
  enabled: true,
  ttlMs: 7 * 24 * 60 * 60 * 1000,
  maxEntries: 64,
  fetchTimeoutMs: 8000,
};

function buildDataUrl(record: CoverCacheRecord): string {
  const mime = record.mimeType ?? "application/octet-stream";
  return `data:${mime};base64,${record.dataBase64}`;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<{ dataBase64: string; mimeType?: string; bytes: number } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      dataBase64: buffer.toString("base64"),
      mimeType: response.headers.get("content-type") ?? undefined,
      bytes: buffer.byteLength,
    };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`Timed out fetching cover ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export class CoverCacheManager {
  private settings: CoverCacheSettings;

  constructor(
    private readonly repositories: { coverCache: CoverCacheRepository },
    initialSettings?: Partial<CoverCacheSettings>,
  ) {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(initialSettings ?? {}),
    };
  }

  getSettings(): CoverCacheSettings {
    return { ...this.settings };
  }

  updateSettings(settings: Partial<CoverCacheSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings,
    };
  }

  async getCachedCover(
    extensionId: string,
    mangaId: string,
  ): Promise<CachedCoverPayload | undefined> {
    const record = this.repositories.coverCache.getCoverCache(extensionId, mangaId);
    if (!record) return undefined;

    const now = Date.now();
    if (record.expiresAt && record.expiresAt <= now) {
      this.repositories.coverCache.deleteCoverCache(extensionId, mangaId);
      return undefined;
    }

    return {
      dataUrl: buildDataUrl(record),
      sourceUrl: record.coverUrl,
      updatedAt: record.updatedAt,
      expiresAt: record.expiresAt ?? undefined,
      mimeType: record.mimeType ?? undefined,
      bytes: record.bytes ?? undefined,
    };
  }

  async ensureCachedCover(
    extensionId: string,
    mangaId: string,
    urls: string[],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.settings.enabled) return;
    if (urls.length === 0) return;

    const now = Date.now();
    const existing = this.repositories.coverCache.getCoverCache(extensionId, mangaId);
    if (existing && (!existing.expiresAt || existing.expiresAt > now)) {
      return;
    }

    const timeoutMs =
      this.settings.fetchTimeoutMs ?? DEFAULT_SETTINGS.fetchTimeoutMs!;

    for (const url of urls) {
      try {
        const fetched = await fetchWithTimeout(url, timeoutMs);
        if (!fetched) continue;

        this.repositories.coverCache.upsertCoverCache(
          extensionId,
          mangaId,
          url,
          fetched.dataBase64,
          {
            mimeType: fetched.mimeType,
            bytes: fetched.bytes,
            metadata,
            ttlMs: this.settings.ttlMs > 0 ? this.settings.ttlMs : undefined,
          }
        );

        this.repositories.coverCache.trimCoverCache(this.settings.maxEntries);
        return;
      } catch (error) {
        // Try next URL
        if (process.env.NODE_ENV !== "production") {
          console.warn(`Cover cache fetch failed for ${url}`, error);
        }
      }
    }
  }

  purgeExpired(nowTs: number = Date.now()): number {
    return this.repositories.coverCache.purgeExpiredCoverCache(nowTs);
  }
}
