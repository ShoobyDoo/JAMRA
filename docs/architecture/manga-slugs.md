# Manga Slug Architecture

## Overview

JAMRA now presents human-readable manga URLs such as `/manga/one-piece` while
preserving the stable source identifiers used for persistence, caching, and
reading progress. Slugs travel from the extension through the SDK, are
normalized and indexed in the catalog database, and can be resolved back to an
ID at the API/service layers. The frontend prefers slugs for routing but always
records reading progress against the immutable ID.

## Extension & SDK

- `packages/weebcentral-extension/src/scraper.ts` populates `slug` beside `id`
  in catalogue/search results and manga details. The slug is derived from the
  `/series/{id}/{name}` segment, lower‑cased, and cached for reuse.
- `packages/extension-sdk/src/types.ts` adds an optional `slug?: string` field
  to `MangaSummary`, which flows through to `MangaDetails` so every consumer of
  SDK types can expose a slug without breaking older extensions.

## Persistence Layer

- Migration `008` (`packages/catalog-db/src/migrations.ts`) adds a `slug` column
  to the `manga` table, normalizes existing `series_name` values to lower-case
  slugs, and creates:
  - `idx_manga_extension_slug` – unique on `(extension_id, slug)` when present;
  - `idx_manga_slug_lookup` – non-unique helper index for slug lookups.
- `CatalogRepository.upsertMangaSummaries` lower-cases incoming slugs (or
  optional `seriesNames`) before storing them. When backfilling via catalogue
  responses we now persist slugs immediately to support deep links.
- `CatalogRepository.getMangaBySlug(extensionId, slug)` provides a normalized
  lookup that returns the associated ID and metadata for downstream services.

## Catalog Service

- `CatalogService.resolveMangaId` accepts either an ID or slug. Resolution flow:
  1. Check the local database via `getMangaBySlug`.
  2. If it still looks like a slug, run `host.invokeSearch` (falling back to
     catalogue when search is unavailable), match against returned slugs or
     slugified titles, persist any matches, and return the resolved ID.
  3. Otherwise treat the identifier as the original ID (legacy flow).
- `CatalogService.syncMangaBySlug` and `syncChapterPages` call
  `resolveMangaId` and emit a clear error when a slug cannot be resolved so the
  API can respond with HTTP 404.
- `/api/catalog` calls now invoke `repository.upsertMangaSummaries` inside the
  route so that every catalogue/search response seeds slug mappings even before
  a detail fetch occurs.

## API Surface

- `GET /api/manga/by-slug/:slug` resolves the slug via the service and returns
  full details plus chapters. Errors from `resolveMangaId` become 404 responses.
- `GET /api/manga/:id` auto-detects slug-like identifiers (lowercase + hyphen
  pattern) and delegates to `syncMangaBySlug`, preserving backward compatibility
  for existing ID URLs.
- `GET /api/manga/:id/chapters/:chapterId/pages` reuses the same detection so
  progressive chapter routes work with either slug or ID.
- `DELETE /api/manga/:id/chapters` still expects an ID; the UI always passes the
  canonical ID when clearing caches.

## Frontend Integration

- `src/lib/api.ts` exposes `fetchMangaBySlug` and updates `fetchMangaDetails`
  to try the slug endpoint first (with graceful fallback to the ID route).
- `src/app/(app)/manga/[slug]/page.tsx` and
  `src/app/read/[slug]/chapter/[number]/page.tsx` resolve the canonical ID from
  the slug, then reuse that ID for chapter/page fetches and reading progress.
- Reader components now distinguish between the persistent `mangaId` (for
  progress) and `mangaSlug` (for navigation URLs). All in-reader navigation,
  including prefetching and auto-advance, uses the slug.
- Search results, cards, breadcrumbs, and continue-reading UI link to
  `/manga/{slug}` while transparently falling back to the ID if a slug is
  unavailable.

## Backward Compatibility & Edge Cases

- Existing ID URLs remain valid: both `/manga/{id}` and `/read/{id}/chapter/...`
  work because the API and reader resolve identifiers dynamically.
- Slugs are normalized to lower-case and de-duped per extension. If a slug
  cannot be resolved via cached data, the service makes a best-effort search and
  caches the mapping for future requests; otherwise users receive a 404.
- Reading progress continues to use the stable ID in both the API payloads and
  the Zustand store, so historical progress records are unaffected by the new
  routing.

## Validation Checklist

- [ ] Catalogue/search responses persist slugs to the database.
- [ ] `/manga/{slug}` returns details and chapters for a slug-only deep link.
- [ ] `/read/{slug}/chapter/{id}` loads pages and updates reading progress.
- [ ] Legacy `/manga/{id}` and `/read/{id}/...` URLs continue to work.
- [ ] Slug collisions across extensions are rejected by
      `idx_manga_extension_slug`.
- [ ] Error handling surfaces a 404 when a slug cannot be resolved.

## Follow-up Considerations

- Extend telemetry/metrics to track slug resolution misses.
- Provide a migration command to retroactively seed slugs for existing library
  items sourced from other extensions once they ship slug support.
