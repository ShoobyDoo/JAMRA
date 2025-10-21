# Manga Slug Architecture

Status: **complete** (rolled out October 2024).

Human-readable URLs (`/manga/{slug}`, `/read/{slug}/chapter/{chapterSlug}`) live
alongside stable internal IDs. Slugs flow from extensions through the catalog
service and API so the UI can present friendly links without sacrificing data
integrity.

## Flow summary

1. **Extensions & SDK** – extensions populate the optional `slug` field on
   `MangaSummary` and `MangaDetails`. The SDK keeps the field optional for
   backward compatibility.
2. **Persistence** – migration 008 adds `slug` to the `manga` table plus a unique
   `(extension_id, slug)` index. `upsertMangaSummaries` normalises slugs to
   lowercase and stores them; `getMangaBySlug` performs lookups.
3. **Service layer** – `catalogService.resolveMangaId` checks the database, then
   falls back to extension search (matching returned slugs or slugified titles),
   persists any new mapping, and returns the canonical ID.
4. **API surface** – `/api/manga/:id` auto-detects slug patterns and defers to
   `syncMangaBySlug`. Dedicated slug endpoints exist for direct lookups and
   chunked page fetches.
5. **Client usage** – API helpers target slug endpoints first, falling back to
   ID routes. UI components keep both `mangaId` (for persistence/progress) and
   `mangaSlug` (for navigation) on hand.

## Behaviour & safeguards

- Slugs are lowercased, hyphenated, and unique per extension; collisions are
  prevented via the composite index.
- Legacy `/manga/{id}` URLs still work. Reading progress, history, and library
  continue to key off the stable IDs so renaming a slug does not lose data.
- Missing slugs trigger a search fallback; if still unresolved, the service
  returns a 404 with a descriptive message that surfaces in the UI.
- Extensions that omit slugs get automatic slugified titles, but explicit slugs
  yield predictable URLs across updates.

## References

- Service logic: `packages/catalog-service/src/catalogService.ts`
- Repository helpers: `packages/catalog-db/src/catalogRepository.ts`
- API client: `src/lib/api/manga.ts`, `src/lib/api/reading.ts`
