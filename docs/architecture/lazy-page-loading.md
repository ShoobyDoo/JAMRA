# Lazy Page Loading

Last reviewed: February 2025 — status **partially adopted**.

## Snapshot

The platform can stream chapter pages in discrete chunks via
`/api/manga/:mangaId/chapters/:chapterId/pages/chunk/:chunk`. The reader still
hydrates the full chapter upfront, revealing the first few pages immediately and
batching the rest in memory. This note captures what already ships and the work
left to complete true streaming.

## Implemented pieces

| Layer | Status | Notes |
| --- | --- | --- |
| Extension SDK | ✅ | `fetchChapterPagesChunk` is optional; host backfills by slicing full results. |
| Extension Host | ✅ | `invokeChapterPagesChunk` falls back to slicing when an extension lacks native chunking. |
| Catalog Service & Server | ✅ | Endpoints expose both full payload and chunked variants. |
| Client API (`src/lib/api/reading.ts`) | ✅ | Chunk calls available but unused by the reader. |
| Reader loader (`useSequentialPageLoader`) | ⚠️ | Sequential hydration of the full payload; no chunk awareness yet. |

## Migration outline

1. **Boot with chunk 0** – request `fetchChapterPagesChunk`, stash `totalChunks`
   and `chunkSize`, and seed the loader cache with the first chunk.
2. **Demand-driven fetches** – when navigation targets an unloaded page, resolve
   the appropriate chunk, store it, and retry the navigation callback.
3. **Cache discipline** – keep a `Set` of fetched chunk indexes, surface retry
   affordances when a request fails, and prune stale chunks when memory pressure
   requires it.
4. **Rollout** – apply to vertical mode first (largest UX win), then paged and
   dual-page layouts. Instrument loader timings to gauge improvements.

## Remaining risks

- Vertical mode renders every page element once loaded; pair chunking with
  virtualization to reduce DOM weight.
- Prefetch heuristics still hydrate the entire chapter in the background; tune
  once chunk loading is live.
- Offline mode currently depends on the in-memory array; integration with the
  offline storage cache is future work.

## References

- Reader architecture: [`docs/manga-reader.md`](../manga-reader.md)
- Loader implementation: `src/components/reader/hooks/use-sequential-page-loader.ts`
- API surface: `src/lib/api/reading.ts`, `packages/catalog-service/src/catalogService.ts`
