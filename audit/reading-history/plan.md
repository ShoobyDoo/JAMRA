# Reading History Fetch Efficiency

## Context

`src/app/(app)/(public)/page.tsx` calls `fetchMangaDetails` for every reading progress entry, even when multiple entries reference the same manga. This causes redundant network requests and increases time-to-first-byte. Error handling also swallows details with `console.error` scattered inline.

## Objectives

- Deduplicate detail fetches per manga id while keeping reactive error handling.
- Centralize enrichment logic in a helper for easier testing and reuse.
- Preserve the existing UI shape and error messaging.

## Plan

1. Create a helper (e.g. `hydrateProgressWithDetails`) in `src/lib/reading-history.ts` that accepts raw progress data, deduplicates manga IDs, fetches details once per ID, and returns enriched records with error metadata.
2. Update `HomePage` to call the helper instead of inlining the enrichment loop.
3. Replace in-component `console.error` calls with structured logging via the existing `logger` where available.
4. Verify behaviour by running `pnpm lint` and (optionally) adding a lightweight unit test for the helper.
