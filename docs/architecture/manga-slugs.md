# Manga Slug Architecture

## ✅ IMPLEMENTATION STATUS: **COMPLETE**

**Implemented**: October 2024
**Approach**: Human-readable URLs with stable ID persistence

JAMRA presents user-friendly manga URLs like `/manga/one-piece` while preserving stable source identifiers for persistence, caching, and reading progress. Slugs flow from extensions through the SDK, are normalized and indexed in the database, and can be resolved back to IDs at the API/service layers.

---

## Overview

### URL Structure

- **Frontend**: `/manga/{slug}` and `/read/{slug}/chapter/{chapterSlug}`
- **Persistence**: All database records use stable manga IDs
- **Resolution**: Service layer converts slugs → IDs transparently

### Benefits

- ✅ **SEO-friendly URLs**: `/manga/one-piece` vs `/manga/2d6cc7e0-6ee8-4...`
- ✅ **User-shareable links**: Easy to read and remember
- ✅ **Stable persistence**: IDs don't change when titles are updated
- ✅ **Backward compatible**: Old ID-based URLs still work

---

## Implementation

### Extension & SDK

**Extension** (`packages/weebcentral-extension/src/scraper.ts`)
- Populates `slug` field in catalogue/search results and manga details
- Derives slug from `/series/{id}/{name}` segment, normalized to lowercase

**SDK Types** (`packages/extension-sdk/src/types.ts`)
- `MangaSummary` has optional `slug?: string` field
- Flows through to `MangaDetails` without breaking older extensions

### Persistence Layer

**Database Migration 008** (`packages/catalog-db/src/migrations.ts`)
- Adds `slug` column to `manga` table
- Creates `idx_manga_extension_slug` - unique on `(extension_id, slug)`
- Creates `idx_manga_slug_lookup` - non-unique helper index
- Normalizes existing `series_name` values to slugs

**Repository** (`packages/catalog-db/src/catalogRepository.ts:983`)
- `getMangaBySlug(extensionId, slug)` - Lookups normalized slug
- `upsertMangaSummaries()` - Lower-cases and stores slugs on insert/update

### Service Layer

**Catalog Service** (`packages/catalog-service/src/catalogService.ts:243`)

`resolveMangaId(extensionId, identifier)` resolution flow:
1. Check database via `getMangaBySlug()`
2. If not found and looks like slug, search via `host.invokeSearch()`
3. Match against returned slugs or slugified titles
4. Persist matches for future requests
5. Return resolved ID or throw error

All service methods (`syncMangaBySlug`, `syncChapterPages`, `fetchChapterPagesChunk`) use `resolveMangaId()` internally.

### API Layer

**Server Endpoints** (`packages/catalog-server/src/server.ts`)
- `GET /api/manga/by-slug/:slug` - Explicit slug resolution endpoint
- `GET /api/manga/:id` - Auto-detects slugs (lowercase + hyphen pattern) and delegates to `syncMangaBySlug()`
- `GET /api/manga/:id/chapters/:chapterId/pages/chunk/:chunk` - Supports both IDs and slugs

**Error Handling**
- Slug not found → HTTP 404 with clear error message
- Invalid slug format → Treated as ID (backward compat)

### Frontend

**API Client** (`src/lib/api.ts`)
- `fetchMangaBySlug()` - Dedicated slug fetch function
- `fetchMangaDetails()` - Tries slug endpoint first, falls back to ID route

**Pages**
- `src/app/(app)/manga/[slug]/page.tsx` - Manga details by slug
- `src/app/read/[slug]/chapter/[chapterSlug]/page.tsx` - Reader by slug

**Components**
- Reader distinguishes `mangaId` (for progress) from `mangaSlug` (for navigation)
- All navigation links use slugs when available, fall back to IDs
- Search results, cards, continue-reading UI link to `/manga/{slug}`

---

## Key Features

### Normalization

- Slugs normalized to lowercase
- Deduplicated per extension via unique index
- Chapter slugs generated from chapter numbers/titles

### Fallback Chain

1. Try slug lookup in database
2. Try search/catalogue match
3. Persist new mapping
4. Fall back to treating identifier as ID

### Backward Compatibility

- Existing `/manga/{id}` URLs continue to work
- Reading progress uses stable IDs (unaffected by slug changes)
- Extensions without slug support automatically get slugified titles

---

## Edge Cases

### Slug Collisions

- Unique index prevents collision within same extension
- Different extensions can have same slug (scoped by `extension_id`)

### Resolution Failures

- Slug not in DB → Search fallback → 404 if not found
- Service emits clear error: `"Manga slug 'xyz' could not be resolved to an ID."`
- Frontend displays 404 page

### Title Changes

- Slug remains unchanged in database
- Reading progress persists via stable ID
- Old bookmarks/shares continue to work

---

## Validation

- ✅ Catalogue/search responses persist slugs
- ✅ `/manga/{slug}` returns details and chapters
- ✅ `/read/{slug}/chapter/{slug}` loads pages and tracks progress
- ✅ Legacy `/manga/{id}` URLs continue to work
- ✅ Slug collisions rejected by unique index
- ✅ 404 error on unresolved slugs

---

## References

- Related: `docs/architecture/lazy-page-loading.md` - Uses slug resolution in chunk endpoints
- Related: `docs/manga-reader-features.md` - Reader navigation with slugs
