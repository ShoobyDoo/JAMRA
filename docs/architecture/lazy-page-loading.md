# Lazy Page Loading Architecture

Last reviewed: February 2025  
Status: **Partially adopted**

---

## Overview

The catalog stack exposes chunk-aware APIs so chapters can be streamed in pieces, but the current reader still retrieves the entire chapter payload up front and hydrates it incrementally on the client. This note captures the implemented building blocks and the remaining work needed to reach full streaming behaviour.

### Current Behaviour

- The reader page (`src/app/read/[slug]/chapter/[chapterSlug]/page.tsx`) calls `fetchChapterPages`, which returns the full list of page metadata in a single response.
- `useSequentialPageLoader` populates an in-memory array: it immediately reveals the first few pages (default 3), then processes the rest in batches (default 5) while optionally preloading images.
- Navigation requests (`goToPage`) ensure a page is present before updating UI state, but no additional network round-trips are issued after the initial fetch.

### Goal

Adopt `/api/manga/:id/chapters/:chapterId/pages/chunk/:chunk` so only the requested chunk is transferred initially, then fetch additional chunks on demand while caching already loaded segments.

---

## Building Blocks

| Layer | Implementation | Notes |
| ----- | -------------- | ----- |
| Extension SDK (`packages/extension-sdk/src/handlers.ts`) | Defines both `fetchChapterPages` and `fetchChapterPagesChunk`. | Chunk handler is optional; the host can fall back to slicing a full payload. |
| Extension Host (`packages/extension-host/src/host.ts`) | `invokeChapterPages` powers the live reader. `invokeChapterPagesChunk` slices full results when the extension lacks native chunking. | Ready for streaming once the client opts in. |
| Catalog Service (`packages/catalog-service/src/catalogService.ts`) | Exposes `fetchChapterPages` (used today) and `fetchChapterPagesChunk`. | Handles slug resolution and repository caching. |
| Catalog Server (`packages/catalog-server/src/server.ts`) | `/pages` endpoint is active. `/pages/chunk/:chunk` is available for incremental loading. | |
| Client API (`src/lib/api/reading.ts`) | `fetchChapterPages` is used by the reader. `fetchChapterPagesChunk` is implemented but unused. | |
| Reader loader (`src/components/reader/hooks/use-sequential-page-loader.ts`) | Sequentially hydrates the full payload; no chunk awareness yet. | |

---

## Migration Plan

1. **Seed with chunk 0**  
   Swap the initial fetch to `fetchChapterPagesChunk`, storing `totalChunks`, `chunkSize`, and the first chunk of pages.

2. **Lazy-load additional chunks**  
   When navigation targets an unloaded page, request the corresponding chunk, cache the result, and retry the navigation once pages are available.

3. **Refine caching**  
   Track loaded chunk indexes to prevent duplicate requests and allow retry semantics when a fetch fails or is aborted.

4. **Progressive rollout**  
   Start with vertical mode (largest gains), then extend to paged layouts after stability is proven. Monitor memory usage and ensure chunk size tuning is configurable.

5. **Tighten error handling**  
   Distinguish between aborted fetches and genuine network failures so the UI displays accurate recovery actions.

---

## Remaining Limitations

- **DOM pressure** — vertical mode still renders every page element once available; virtualisation is tracked separately.
- **Prefetch heuristics** — the loader continues to hydrate the entire chapter after the initial batch, which can be heavy for very long chapters.
- **Offline resilience** — hard refreshes drop the hydrated array; pairing chunk caching with `packages/offline-storage` is future work.

---

## References

- Reader overview: [`docs/manga-reader.md`](../manga-reader.md)
- Loader implementation: `src/components/reader/hooks/use-sequential-page-loader.ts`
- Chunk API definitions: `src/lib/api/reading.ts`, `packages/catalog-service/src/catalogService.ts`

Keep this document in sync as streaming support rolls out; replace the migration plan with concrete behaviour once chunk loading ships.
