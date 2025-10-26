import type { MangaRepository } from "@jamra/catalog-db";

export class CoverUrlService {
  constructor(private readonly repositories?: { manga: MangaRepository }) {}

  /**
   * Sanitize cover URLs by removing duplicates, invalid URLs, and non-HTTP(S) protocols
   */
  sanitize(urls: Iterable<string | undefined>): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];

    for (const raw of urls) {
      if (!raw) continue;
      if (!/^https?:\/\//i.test(raw)) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);
      ordered.push(raw);
    }

    return ordered;
  }

  /**
   * Merge preferred URLs with provided URLs, maintaining order and removing duplicates
   */
  merge(
    preferred: string[] | undefined,
    provided: string[] | undefined,
  ): string[] {
    if (!preferred?.length) {
      return this.sanitize(provided ?? []);
    }

    const merged = [...preferred, ...(provided ?? [])];
    return this.sanitize(merged);
  }

  /**
   * Get stored cover URL order from repository
   */
  getStoredOrder(extensionId: string, mangaId: string): string[] | undefined {
    return this.repositories?.manga.getMangaCoverUrls(extensionId, mangaId);
  }

  /**
   * Update cover URL order in repository
   */
  updateOrder(extensionId: string, mangaId: string, urls: string[]): void {
    if (this.repositories && urls.length > 0) {
      this.repositories.manga.updateMangaCoverUrls(extensionId, mangaId, urls);
    }
  }

  /**
   * Report successful cover URL fetch
   */
  reportSuccess(
    extensionId: string,
    mangaId: string,
    successfulUrl: string,
    attemptedUrls: string[],
  ): void {
    if (!this.repositories) return;

    const preferred = this.sanitize([successfulUrl, ...attemptedUrls]);
    const storedOrder = this.getStoredOrder(extensionId, mangaId) ?? [];
    const merged = this.merge(preferred, storedOrder);

    if (merged.length > 0) {
      this.updateOrder(extensionId, mangaId, merged);
    }
  }

  /**
   * Report failed cover URL fetch by deprioritizing the failed URL
   */
  reportFailure(
    extensionId: string,
    mangaId: string,
    failedUrl: string,
    attemptedUrls: string[],
  ): void {
    if (!this.repositories) return;

    const storedOrder = this.getStoredOrder(extensionId, mangaId) ?? [];
    const filteredStored = storedOrder.filter((url) => url !== failedUrl);
    const newOrder = this.sanitize([
      ...attemptedUrls.filter((url) => url !== failedUrl),
      ...filteredStored,
      failedUrl,
    ]);

    if (newOrder.length > 0) {
      this.updateOrder(extensionId, mangaId, newOrder);
    }
  }

  /**
   * Check if two URL arrays are equal
   */
  areArraysEqual(a?: string[], b?: string[]): boolean {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}
