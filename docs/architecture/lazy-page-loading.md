# Lazy Page Loading Architecture

## ✅ IMPLEMENTATION STATUS: **COMPLETE**

**Implemented**: October 2024
**Approach**: SDK-Level Streaming (Option A)
**Performance**: First chunk (10 pages) loads in ~1 second, remaining chunks stream progressively

---

## Overview

The chunked page loading system prioritizes loading the first chunk of pages immediately while streaming the remaining pages in the background. This provides a fast perceived load time while maintaining the ability to read large chapters.

### Problem Solved

- **Before**: All pages loaded synchronously (5+ second wait)
- **After**: First 10 pages load in ~1 second, rest stream in background

---

## Architecture

### Data Flow

1. **User navigates** → `/read/{slug}/chapter/{chapterSlug}`
2. **Server page** → Fetches first chunk (10 pages) via `fetchChapterPagesChunk()`
3. **Client reader** → Renders immediately with initial chunk
4. **Background loading** → Sequentially fetches remaining chunks on-demand

### Implementation Files

#### Backend Stack

**Extension SDK** (`packages/extension-sdk/src/handlers.ts`)

- `FetchChapterPagesChunkRequest` - Request interface with chunk/chunkSize params
- `ChapterPagesChunk` - Response interface with totalPages/totalChunks metadata

**Extension Host** (`packages/extension-host/src/host.ts:343`)

- `invokeChapterPagesChunk()` - Invokes extension handler
- **Fallback**: If extension doesn't support chunking, fetches all pages then slices

**Catalog Service** (`packages/catalog-service/src/catalogService.ts:178`)

- `fetchChapterPagesChunk()` - Service-layer method
- Supports both manga IDs and slugs via `resolveMangaId()`

**API Server** (`packages/catalog-server/src/server.ts:951`)

- `GET /api/manga/:id/chapters/:chapterId/pages/chunk/:chunk?size={chunkSize}`
- Default chunk size: 10 pages
- Returns: `{ chunk, chunkSize, totalChunks, totalPages, pages[] }`

#### Frontend Stack

**API Client** (`src/lib/api.ts:372`)

- `fetchChapterPagesChunk()` - Fetches a specific chunk
- Supports optional `extensionId` parameter

**Reader Page** (`src/app/read/[slug]/chapter/[chapterSlug]/page.tsx:82`)

- Fetches initial chunk (chunk 0, size 10) server-side
- Passes `initialPages`, `totalPages`, `initialChunkIndex`, `totalChunks` to reader
- **Fallback**: On chunk failure, falls back to full page fetch

**Reader Component** (`src/components/reader/manga-reader.tsx:108`)

- Manages `pagesRef` array (sparse, with null placeholders)
- `loadChunk(chunkIndex)` - Loads specific chunk on-demand
- `ensurePageAvailable(pageIndex)` - Ensures page is loaded before navigating
- `enqueueSequentialChunks()` - Queues all remaining chunks for background loading
- **Error handling**: Retry UI with error messages

---

## Key Features

### Smart Chunk Loading

1. **Initial load**: Server fetches chunk containing requested page
2. **On navigation**: Client ensures target page is loaded before changing `currentPage`
3. **Background loading**: Sequential queue loads remaining chunks after initial render
4. **Deduplication**: Tracks `loadedChunksRef` and `loadingChunkPromisesRef` to prevent duplicate requests

### Backward Compatibility

- Extensions without `fetchChapterPagesChunk` handler fall back to full fetch
- Extension host automatically chunks the full response
- Progressive UX maintained even with old extensions

### Error Handling

- Chunk load failures show retry UI overlay
- Failed chunks can be retried individually
- Sequential queue retries failed chunks on next attempt

---

## Performance Metrics

### Network

- **Before**: Single request for all pages (5+ seconds)
- **After**:
  - Initial chunk: ~1 second
  - Background chunks: Loaded sequentially as needed
  - Total bandwidth: Same, but spread over time

### User Experience

- **Time to First Paint**: ~1 second (down from 5+ seconds)
- **Time to Interactive**: Immediate after first chunk
- **Perceived Performance**: 5x improvement

### Edge Cases

- **Short chapters (<10 pages)**: Single chunk, behaves like traditional load
- **Slow network**: User can start reading while rest loads
- **Navigation to unloaded page**: Shows loading state, fetches chunk, then navigates

---

## Future Optimizations

### Potential Improvements

1. **Parallel chunk loading**: Load multiple chunks concurrently (currently sequential)
2. **Predictive prefetching**: Preload next chapter's first chunk when user reaches last few pages
3. **Chunk size adaptation**: Adjust chunk size based on network speed
4. **Service worker caching**: Cache chunks for offline reading

### Extension Ecosystem

- Current extensions: WeebCentral supports native chunking
- Future extensions: Can implement `fetchChapterPagesChunk` for optimal performance
- Legacy extensions: Automatically get chunked responses via host fallback

---

## Testing Coverage

- ✅ First chunk loads in <1 second
- ✅ Remaining chunks load in background
- ✅ Legacy extensions work via fallback
- ✅ Error handling and retry
- ✅ Network interruption handling
- ✅ Page navigation to unloaded pages
- ✅ Chapter navigation clears chunk state
- ⚠️ Very large chapters (100+ pages) - needs performance testing

---

## References

- Original planning doc: This file (pre-October 2024 version)
- Related: `docs/architecture/manga-slugs.md` - Slug resolution used in chunk loading
- Related: `docs/manga-reader-features.md` - Reader UI features
