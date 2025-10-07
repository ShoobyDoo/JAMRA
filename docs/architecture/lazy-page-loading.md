# Lazy Page Loading Architecture

## Problem Statement

Chapter pages currently load all pages synchronously before showing the reader UI, causing 5+ second load times. This creates poor UX, especially for chapters with 20+ pages.

**Current Flow**:
1. User clicks chapter → Navigate to `/read/{manga}/{chapter}`
2. Server-side fetch ALL pages (`getChapterPages()`)
3. Wait for all pages to load
4. Render reader with all pages

**Goal**: Prioritize first 5 pages, load rest asynchronously in background.

## Proposed Solution

### Architecture Options

#### Option A: SDK-Level Streaming (Preferred)

Extend the Extension SDK to support streaming/paginated page fetching:

**Pros**:
- Clean separation of concerns
- Extensions control chunking logic
- Easy to implement per-source optimizations

**Cons**:
- Requires SDK breaking change
- All extensions need updates

#### Option B: Service-Layer Chunking

Chunk page loading in catalog service without SDK changes:

**Pros**:
- No SDK changes needed
- Works with existing extensions

**Cons**:
- Hacky - fetches all then chunks
- Doesn't solve underlying latency issue

**Decision**: Go with **Option A** for long-term benefits.

---

## Implementation: Option A (SDK-Level Streaming)

### 1. SDK Changes

**File**: `packages/extension-sdk/src/types.ts`

Add new streaming interface alongside existing one:

```typescript
// Existing (keep for backward compat)
export interface ChapterPages {
  chapterId: string;
  mangaId: string;
  pages: PageImage[];
}

// New streaming interface
export interface PageChunk {
  chapterId: string;
  mangaId: string;
  chunk: number;        // 0-indexed chunk number
  totalChunks: number;  // Total number of chunks
  pages: PageImage[];   // Pages in this chunk
  hasMore: boolean;     // Whether more chunks exist
}

export interface FetchChapterPagesRequest {
  mangaId: string;
  chapterId: string;
  chunk?: number;       // Optional: which chunk to fetch (default: 0)
  chunkSize?: number;   // Optional: pages per chunk (default: 5)
}
```

**File**: `packages/extension-sdk/src/extension.ts`

Update handler interface:

```typescript
export interface ExtensionHandlers {
  // ... existing handlers

  // Keep existing for backward compat
  fetchChapterPages?(
    context: ExtensionContext,
    request: FetchChapterPagesRequest
  ): Promise<ChapterPages>;

  // New streaming handler (optional)
  fetchChapterPagesChunked?(
    context: ExtensionContext,
    request: FetchChapterPagesRequest
  ): Promise<PageChunk>;
}
```

### 2. Extension Implementation

**File**: `packages/weebcentral-extension/src/scraper.ts`

Implement chunked fetching:

```typescript
export class WeebCentralScraper {
  // Keep existing method for backward compat
  async getChapterPages(chapterId: string): Promise<ChapterPages> {
    // ... existing implementation
  }

  // New chunked method
  async getChapterPagesChunked(
    chapterId: string,
    chunk: number = 0,
    chunkSize: number = 5
  ): Promise<PageChunk> {
    const url = `${BASE_URL}/chapters/${chapterId}/images?reading_style=long_strip`;

    const html = await this.rateLimiter.throttle(async () => {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.text();
    });

    const $ = cheerio.load(html);
    const allPages: PageImage[] = [];

    $('section[x-data] img, section img[src*="manga"]').each((i, el) => {
      const src = $(el).attr("src");
      if (src && src.includes("manga") && !src.includes("logo")) {
        const width = $(el).attr("width");
        const height = $(el).attr("height");

        allPages.push({
          index: i,
          url: src,
          width: width ? parseInt(width) : undefined,
          height: height ? parseInt(height) : undefined,
        });
      }
    });

    // Calculate chunk boundaries
    const startIdx = chunk * chunkSize;
    const endIdx = Math.min(startIdx + chunkSize, allPages.length);
    const totalChunks = Math.ceil(allPages.length / chunkSize);

    return {
      chapterId,
      mangaId: "", // Not available from this endpoint
      chunk,
      totalChunks,
      pages: allPages.slice(startIdx, endIdx),
      hasMore: chunk < totalChunks - 1,
    };
  }
}
```

**File**: `packages/weebcentral-extension/src/index.ts`

Register both handlers:

```typescript
const extension: ExtensionModule = {
  manifest: { /* ... */ },
  handlers: {
    // ... existing handlers

    // Keep for backward compat
    async fetchChapterPages(context, request) {
      scraper.setCache(context.cache);
      return await scraper.getChapterPages(request.chapterId);
    },

    // New chunked handler
    async fetchChapterPagesChunked(context, request) {
      scraper.setCache(context.cache);
      return await scraper.getChapterPagesChunked(
        request.chapterId,
        request.chunk ?? 0,
        request.chunkSize ?? 5
      );
    },
  },
};
```

### 3. Extension Host Changes

**File**: `packages/extension-host/src/host.ts`

Add new method for chunked fetching:

```typescript
export class ExtensionHost {
  // Keep existing method
  async invokeChapterPages(
    extensionId: string,
    request: FetchChapterPagesRequest
  ): Promise<ChapterPages> {
    // ... existing implementation
  }

  // New chunked method
  async invokeChapterPagesChunked(
    extensionId: string,
    request: FetchChapterPagesRequest
  ): Promise<PageChunk> {
    const record = this.extensions.get(extensionId);
    if (!record) {
      throw new ExtensionNotFoundError(extensionId);
    }

    const handler = record.module.handlers.fetchChapterPagesChunked;
    if (!handler) {
      // Fallback: fetch all pages and chunk them
      const allPages = await this.invokeChapterPages(extensionId, request);
      const chunkSize = request.chunkSize ?? 5;
      const chunk = request.chunk ?? 0;

      const startIdx = chunk * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, allPages.pages.length);
      const totalChunks = Math.ceil(allPages.pages.length / chunkSize);

      return {
        chapterId: allPages.chapterId,
        mangaId: allPages.mangaId,
        chunk,
        totalChunks,
        pages: allPages.pages.slice(startIdx, endIdx),
        hasMore: chunk < totalChunks - 1,
      };
    }

    return handler(record.baseContext, request);
  }
}
```

### 4. Catalog Service Changes

**File**: `packages/catalog-service/src/catalogService.ts`

Add chunked page fetching method:

```typescript
export class CatalogService {
  // Keep existing method
  async syncChapterPages(
    extensionId: string,
    mangaId: string,
    chapterId: string
  ): Promise<ChapterPagesSyncResult> {
    // ... existing implementation
  }

  // New chunked method
  async fetchChapterPagesChunk(
    extensionId: string,
    mangaId: string,
    chapterId: string,
    chunk: number = 0,
    chunkSize: number = 5
  ): Promise<PageChunk> {
    return this.host.invokeChapterPagesChunked(extensionId, {
      mangaId,
      chapterId,
      chunk,
      chunkSize,
    });
  }
}
```

### 5. API Server Changes

**File**: `packages/catalog-server/src/server.ts`

Add new chunked endpoint:

```typescript
// Existing endpoint (keep for compat)
app.get("/api/manga/:id/chapters/:chapterId/pages", async (req, res) => {
  // ... existing implementation
});

// New chunked endpoint
app.get("/api/manga/:id/chapters/:chapterId/pages/chunk/:chunk", async (req, res) => {
  const { id: mangaId, chapterId, chunk } = req.params;
  const chunkNum = parseInt(chunk, 10);
  const chunkSize = parseInt(req.query.size as string, 10) || 5;

  if (isNaN(chunkNum) || chunkNum < 0) {
    return res.status(400).json({ error: "Invalid chunk number" });
  }

  try {
    const pageChunk = await catalogService.fetchChapterPagesChunk(
      activeExtensionId!,
      mangaId,
      chapterId,
      chunkNum,
      chunkSize
    );

    res.json(pageChunk);
  } catch (error) {
    handleError(res, error, "Failed to fetch chapter pages chunk");
  }
});
```

### 6. Frontend API Client

**File**: `src/lib/api.ts`

Add chunked fetching functions:

```typescript
export interface PageChunk {
  chapterId: string;
  mangaId: string;
  chunk: number;
  totalChunks: number;
  pages: Array<{
    index: number;
    url: string;
    width?: number;
    height?: number;
  }>;
  hasMore: boolean;
}

export async function fetchChapterPagesChunk(
  mangaId: string,
  chapterId: string,
  chunk: number = 0,
  chunkSize: number = 5
): Promise<PageChunk> {
  const response = await fetch(
    `${API_BASE_URL}/api/manga/${mangaId}/chapters/${chapterId}/pages/chunk/${chunk}?size=${chunkSize}`
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// Helper to fetch all chunks progressively
export async function* fetchChapterPagesProgressive(
  mangaId: string,
  chapterId: string,
  chunkSize: number = 5
): AsyncGenerator<PageChunk, void, unknown> {
  let chunk = 0;
  let hasMore = true;

  while (hasMore) {
    const pageChunk = await fetchChapterPagesChunk(mangaId, chapterId, chunk, chunkSize);
    yield pageChunk;

    hasMore = pageChunk.hasMore;
    chunk++;
  }
}
```

### 7. Reader Component Updates

**File**: `src/components/reader/manga-reader.tsx`

Update to use progressive loading:

```tsx
"use client";

import { useState, useEffect } from "react";
import { fetchChapterPagesProgressive } from "@/lib/api";
import type { PageChunk } from "@/lib/api";

interface MangaReaderProps {
  mangaId: string;
  chapterId: string;
}

export function MangaReader({ mangaId, chapterId }: MangaReaderProps) {
  const [pages, setPages] = useState<PageChunk["pages"]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalChunks, setTotalChunks] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPages() {
      setLoading(true);
      const newPages: PageChunk["pages"] = [];

      try {
        const generator = fetchChapterPagesProgressive(mangaId, chapterId, 5);

        for await (const chunk of generator) {
          if (cancelled) break;

          newPages.push(...chunk.pages);
          setPages([...newPages]);
          setTotalChunks(chunk.totalChunks);

          // Show initial pages immediately
          if (chunk.chunk === 0) {
            setLoading(false);
            setLoadingMore(true);
          }
        }
      } catch (error) {
        console.error("Failed to load pages:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    }

    loadPages();

    return () => {
      cancelled = true;
    };
  }, [mangaId, chapterId]);

  if (loading && pages.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader size="xl" />
        <p className="ml-4 text-muted-foreground">Loading first pages...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Render pages */}
      {pages.map((page) => (
        <img key={page.index} src={page.url} alt={`Page ${page.index + 1}`} />
      ))}

      {/* Loading indicator for remaining pages */}
      {loadingMore && (
        <div className="flex justify-center py-8">
          <Loader size="md" />
          <p className="ml-4 text-sm text-muted-foreground">
            Loading remaining pages...
          </p>
        </div>
      )}
    </div>
  );
}
```

## Performance Improvements

### Before:
- **Time to First Paint**: 5+ seconds (wait for all pages)
- **Perceived Load Time**: 5+ seconds
- **Network**: All pages fetched serially

### After:
- **Time to First Paint**: ~1 second (first 5 pages only)
- **Perceived Load Time**: ~1 second (user can start reading)
- **Network**: Chunked parallel fetching in background

## Migration Strategy

### Phase 1: Backward Compatible Addition
1. Add new SDK interfaces (keep old ones)
2. Implement chunked handlers in WeebCentral extension
3. Add fallback in extension host (chunk old responses)
4. Deploy new API endpoints

### Phase 2: Frontend Adoption
1. Update reader to use progressive loading
2. Test with both old and new extensions
3. Monitor performance improvements

### Phase 3: Ecosystem Migration
1. Document chunked fetching in extension guide
2. Encourage other extensions to adopt
3. Keep backward compat indefinitely

## Testing Checklist

- [ ] First 5 pages load in <1 second
- [ ] Remaining pages load in background
- [ ] Old extensions still work (fallback chunking)
- [ ] Error handling for failed chunks
- [ ] Network interruption handling
- [ ] Progress indicator accuracy

## Edge Cases

### Slow Network
- Show progress bar based on chunks loaded
- Allow reading while loading
- Retry failed chunks

### Extension Doesn't Support Chunking
- Extension host falls back to fetch-all-then-chunk
- Still provides progressive UX via client-side chunking

### Very Short Chapters (<5 pages)
- Single chunk, behaves like current implementation
- No overhead from chunking

## Timeline Estimate

- **SDK Changes**: 2 hours
- **Extension Implementation**: 2 hours
- **Host + Service Changes**: 2 hours
- **API Endpoint**: 1 hour
- **Frontend Updates**: 4-5 hours
- **Testing**: 3 hours

**Total**: ~14-16 hours of development
