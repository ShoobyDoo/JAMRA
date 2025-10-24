/**
 * Metadata Cache
 *
 * Simple LRU cache for manga and chapter metadata to avoid redundant network requests.
 * During downloads, we often fetch the same manga/chapter data multiple times.
 * This cache eliminates those redundant calls.
 */

import type { MangaDetails, ChapterPages } from "@jamra/extension-sdk";

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

interface MangaCacheKey {
  extensionId: string;
  mangaId: string;
}

interface ChapterPagesCacheKey {
  extensionId: string;
  mangaId: string;
  chapterId: string;
}

/**
 * Simple LRU cache with TTL support
 */
export class MetadataCache {
  private readonly mangaCache = new Map<string, CacheEntry<MangaDetails>>();
  private readonly chapterPagesCache = new Map<string, CacheEntry<ChapterPages>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(options: { maxSize?: number; ttlMs?: number } = {}) {
    this.maxSize = options.maxSize ?? 100; // Cache up to 100 items per type
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes default TTL
  }

  /**
   * Get cached manga details
   */
  getManga(key: MangaCacheKey): MangaDetails | undefined {
    const cacheKey = this.getMangaKey(key);
    const entry = this.mangaCache.get(cacheKey);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.mangaCache.delete(cacheKey);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Cache manga details
   */
  setManga(key: MangaCacheKey, manga: MangaDetails): void {
    const cacheKey = this.getMangaKey(key);

    // Evict oldest entry if cache is full
    if (this.mangaCache.size >= this.maxSize && !this.mangaCache.has(cacheKey)) {
      const firstKey = this.mangaCache.keys().next().value;
      if (firstKey) {
        this.mangaCache.delete(firstKey);
      }
    }

    this.mangaCache.set(cacheKey, {
      value: manga,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached chapter pages
   */
  getChapterPages(key: ChapterPagesCacheKey): ChapterPages | undefined {
    const cacheKey = this.getChapterPagesKey(key);
    const entry = this.chapterPagesCache.get(cacheKey);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.chapterPagesCache.delete(cacheKey);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Cache chapter pages
   */
  setChapterPages(key: ChapterPagesCacheKey, pages: ChapterPages): void {
    const cacheKey = this.getChapterPagesKey(key);

    // Evict oldest entry if cache is full
    if (
      this.chapterPagesCache.size >= this.maxSize &&
      !this.chapterPagesCache.has(cacheKey)
    ) {
      const firstKey = this.chapterPagesCache.keys().next().value;
      if (firstKey) {
        this.chapterPagesCache.delete(firstKey);
      }
    }

    this.chapterPagesCache.set(cacheKey, {
      value: pages,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.mangaCache.clear();
    this.chapterPagesCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    mangaCacheSize: number;
    chapterPagesCacheSize: number;
  } {
    return {
      mangaCacheSize: this.mangaCache.size,
      chapterPagesCacheSize: this.chapterPagesCache.size,
    };
  }

  private getMangaKey(key: MangaCacheKey): string {
    return `${key.extensionId}:${key.mangaId}`;
  }

  private getChapterPagesKey(key: ChapterPagesCacheKey): string {
    return `${key.extensionId}:${key.mangaId}:${key.chapterId}`;
  }
}
