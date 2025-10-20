import { request } from "./client";
import type { CachedCoverPayload } from "./shared";

export interface CatalogueItem {
  id: string;
  slug?: string;
  title: string;
  altTitles?: string[];
  coverUrl?: string;
  coverUrls?: string[];
  cachedCover?: CachedCoverPayload;
  description?: string;
  status?: string;
  tags?: string[];
  demographic?: string;
  languageCode?: string;
  updatedAt?: string;
}

export type MangaSummary = CatalogueItem;

export interface CataloguePage {
  page: number;
  hasMore: boolean;
  items: CatalogueItem[];
  extensionId?: string;
}

export interface CatalogueQueryOptions {
  page?: number;
  query?: string;
  filters?: Record<string, unknown>;
  extensionId?: string;
}

export async function fetchCataloguePage(
  options: CatalogueQueryOptions = {},
): Promise<CataloguePage> {
  const searchParams = new URLSearchParams({
    page: String(options.page ?? 1),
  });

  if (options.query) {
    searchParams.set("query", options.query);
  }

  if (options.filters) {
    searchParams.set("filters", JSON.stringify(options.filters));
  }

  if (options.extensionId) {
    searchParams.set("extensionId", options.extensionId);
  }

  return request<CataloguePage>(`/catalog?${searchParams.toString()}`);
}
