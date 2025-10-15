import type { CatalogueItem, MangaDetails } from "@/lib/api";

type CoverSourceEntity =
  | Pick<CatalogueItem, "coverUrl" | "coverUrls" | "cachedCover">
  | Pick<MangaDetails, "coverUrl" | "coverUrls" | "cachedCover">;

export interface ResolvedCoverSources {
  primary?: string;
  fallbacks: string[];
}

function uniqueUrls(urls: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    ordered.push(url);
  }
  return ordered;
}

export function resolveCoverSources(entity: CoverSourceEntity): ResolvedCoverSources {
  const orderedFallbacks = uniqueUrls([
    entity.cachedCover?.sourceUrl,
    entity.coverUrl,
    ...(entity.coverUrls ?? []),
  ]);

  const primary =
    entity.cachedCover?.dataUrl ??
    (orderedFallbacks.length > 0 ? orderedFallbacks[0] : undefined);

  const fallbacks =
    primary !== undefined
      ? orderedFallbacks.filter((url) => url !== primary)
      : orderedFallbacks;

  return { primary, fallbacks };
}
