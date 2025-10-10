# Offline Storage Architecture

## Overview

The offline storage system allows users to download manga chapters for offline reading. Downloads are intelligently managed with queue-based processing, progress tracking, and automatic cleanup.

---

## Storage Structure

### Directory Layout

```
.jamra-data/
└── offline/
    └── {extension-id}/
        └── {manga-slug}/
            ├── metadata.json              # Manga-level metadata
            ├── cover.jpg                  # Manga cover image
            └── chapters/
                ├── chapter-0001/
                │   ├── metadata.json      # Chapter-level metadata
                │   ├── page-0001.jpg
                │   ├── page-0002.jpg
                │   └── ...
                ├── chapter-0002/
                │   └── ...
                └── ...
```

### Example Paths

```
.jamra-data/offline/weebcentral/one-piece/metadata.json
.jamra-data/offline/weebcentral/one-piece/cover.jpg
.jamra-data/offline/weebcentral/one-piece/chapters/chapter-0001/metadata.json
.jamra-data/offline/weebcentral/one-piece/chapters/chapter-0001/page-0001.jpg
```

---

## Metadata Schemas

### Manga Metadata (`metadata.json`)

Stores everything needed to rebuild the manga details page offline.

```typescript
interface OfflineMangaMetadata {
  version: 1;                          // Schema version for migrations
  downloadedAt: number;                // Unix timestamp
  lastUpdatedAt: number;               // Unix timestamp

  // Manga details
  mangaId: string;                     // Stable internal ID
  slug: string;                        // URL slug
  extensionId: string;                 // Source extension
  title: string;
  description?: string;
  coverUrl?: string;                   // Original URL (for reference)
  coverPath: string;                   // Relative path: "cover.jpg"
  authors?: string[];
  artists?: string[];
  genres?: string[];
  tags?: string[];
  rating?: number;
  year?: number;
  status?: string;
  demographic?: string;
  altTitles?: string[];

  // Downloaded chapters mapping
  chapters: OfflineChapterMetadata[];
}

interface OfflineChapterMetadata {
  chapterId: string;                   // Stable internal ID
  slug: string;                        // URL slug
  number?: string;                     // "1", "1.5", etc.
  title?: string;                      // Full title: "Into the Fray!"
  displayTitle: string;                // Computed: "Chapter 1 - Into the Fray!"
  volume?: string;
  publishedAt?: string;
  languageCode?: string;
  scanlators?: string[];

  // Chapter storage info
  folderName: string;                  // "chapter-0001"
  totalPages: number;
  downloadedAt: number;                // Unix timestamp
  sizeBytes: number;                   // Total size of all pages
}
```

### Chapter Metadata (`chapters/chapter-XXXX/metadata.json`)

Stores page-level information for each chapter.

```typescript
interface OfflineChapterPages {
  version: 1;
  downloadedAt: number;

  chapterId: string;
  mangaId: string;
  folderName: string;                  // "chapter-0001"

  pages: OfflinePageMetadata[];
}

interface OfflinePageMetadata {
  index: number;                       // 0-indexed page number
  originalUrl: string;                 // Original source URL
  filename: string;                    // "page-0001.jpg"
  width?: number;
  height?: number;
  sizeBytes: number;
  mimeType: string;                    // "image/jpeg", "image/png", etc.
}
```

---

## Database Schema

Add new tables to SQLite database for tracking downloads.

```sql
-- Downloaded manga tracking
CREATE TABLE IF NOT EXISTS offline_manga (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  extension_id TEXT NOT NULL,
  manga_id TEXT NOT NULL,
  manga_slug TEXT NOT NULL,
  download_path TEXT NOT NULL,          -- Relative path from .jamra-data/offline/
  downloaded_at INTEGER NOT NULL,
  last_updated_at INTEGER NOT NULL,
  total_size_bytes INTEGER DEFAULT 0,

  UNIQUE(extension_id, manga_id)
);

CREATE INDEX idx_offline_manga_slug ON offline_manga(extension_id, manga_slug);

-- Downloaded chapters tracking
CREATE TABLE IF NOT EXISTS offline_chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offline_manga_id INTEGER NOT NULL,
  chapter_id TEXT NOT NULL,
  chapter_number TEXT,
  chapter_title TEXT,
  folder_name TEXT NOT NULL,
  total_pages INTEGER NOT NULL,
  downloaded_at INTEGER NOT NULL,
  size_bytes INTEGER DEFAULT 0,

  FOREIGN KEY (offline_manga_id) REFERENCES offline_manga(id) ON DELETE CASCADE,
  UNIQUE(offline_manga_id, chapter_id)
);

CREATE INDEX idx_offline_chapters_manga ON offline_chapters(offline_manga_id);

-- Download queue
CREATE TABLE IF NOT EXISTS download_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  extension_id TEXT NOT NULL,
  manga_id TEXT NOT NULL,
  manga_slug TEXT NOT NULL,
  chapter_id TEXT,                      -- NULL means "download all chapters"
  status TEXT NOT NULL,                 -- 'queued', 'downloading', 'completed', 'failed'
  priority INTEGER DEFAULT 0,           -- Higher = more important
  queued_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT,
  progress_current INTEGER DEFAULT 0,   -- Pages downloaded
  progress_total INTEGER DEFAULT 0,     -- Total pages to download

  UNIQUE(extension_id, manga_id, chapter_id)
);

CREATE INDEX idx_download_queue_status ON download_queue(status, priority DESC, queued_at ASC);
```

---

## Implementation

### Package Structure

```
packages/offline-storage/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    # Public API exports
    ├── manager.ts                  # OfflineStorageManager class
    ├── downloader.ts               # Download worker logic
    ├── repository.ts               # SQLite repository
    ├── types.ts                    # TypeScript interfaces
    └── utils/
        ├── file-system.ts          # Node.js fs operations
        ├── image-download.ts       # Image fetching & saving
        └── metadata.ts             # Metadata serialization
```

### Core Classes

#### 1. OfflineStorageManager

Main entry point for offline storage operations.

```typescript
export class OfflineStorageManager {
  constructor(
    private readonly dataDir: string,           // .jamra-data path
    private readonly repository: OfflineRepository,
    private readonly catalogService: CatalogService
  ) {}

  // Queue management
  async queueChapterDownload(
    extensionId: string,
    mangaId: string,
    chapterId: string,
    priority?: number
  ): Promise<void>

  async queueMangaDownload(
    extensionId: string,
    mangaId: string,
    chapterIds?: string[],  // Download specific chapters, or all if undefined
    priority?: number
  ): Promise<void>

  async cancelDownload(queueId: number): Promise<void>
  async pauseDownloads(): Promise<void>
  async resumeDownloads(): Promise<void>

  // Query operations
  async isChapterDownloaded(mangaId: string, chapterId: string): Promise<boolean>
  async isMangaDownloaded(mangaId: string): Promise<boolean>
  async getDownloadedManga(): Promise<OfflineMangaMetadata[]>
  async getDownloadedChapters(mangaId: string): Promise<OfflineChapterMetadata[]>
  async getDownloadProgress(queueId: number): Promise<DownloadProgress | null>
  async getQueuedDownloads(): Promise<QueuedDownload[]>

  // Delete operations
  async deleteChapter(mangaId: string, chapterId: string): Promise<void>
  async deleteManga(mangaId: string): Promise<void>
  async clearAllDownloads(): Promise<void>

  // Size management
  async getTotalStorageSize(): Promise<number>
  async getMangaStorageSize(mangaId: string): Promise<number>
}
```

#### 2. DownloadWorker

Background worker that processes download queue.

```typescript
export class DownloadWorker {
  private isRunning = false;
  private currentDownload: QueuedDownload | null = null;

  async start(): Promise<void>
  async stop(): Promise<void>

  private async processQueue(): Promise<void> {
    while (this.isRunning) {
      const item = await this.repository.getNextQueuedDownload();
      if (!item) {
        await this.sleep(1000);
        continue;
      }

      try {
        this.currentDownload = item;
        await this.downloadItem(item);
      } catch (error) {
        await this.handleDownloadError(item, error);
      } finally {
        this.currentDownload = null;
      }
    }
  }

  private async downloadItem(item: QueuedDownload): Promise<void> {
    // Mark as downloading
    await this.repository.updateQueueStatus(item.id, 'downloading');

    if (item.chapterId) {
      // Download single chapter
      await this.downloadChapter(item);
    } else {
      // Download all manga chapters
      await this.downloadManga(item);
    }

    // Mark as completed
    await this.repository.updateQueueStatus(item.id, 'completed');
  }

  private async downloadChapter(item: QueuedDownload): Promise<void>
  private async downloadManga(item: QueuedDownload): Promise<void>
}
```

#### 3. ImageDownloader

Handles image fetching and saving with retry logic.

```typescript
export class ImageDownloader {
  constructor(
    private readonly maxRetries: number = 3,
    private readonly retryDelay: number = 1000
  ) {}

  async downloadImage(
    url: string,
    destPath: string,
    onProgress?: (bytes: number) => void
  ): Promise<{ sizeBytes: number; mimeType: string }> {
    let attempt = 0;

    while (attempt < this.maxRetries) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const mimeType = response.headers.get('content-type') || 'image/jpeg';

        // Ensure directory exists
        await fs.mkdir(path.dirname(destPath), { recursive: true });

        // Write file
        await fs.writeFile(destPath, Buffer.from(buffer));

        return { sizeBytes: buffer.byteLength, mimeType };
      } catch (error) {
        attempt++;
        if (attempt >= this.maxRetries) throw error;
        await this.sleep(this.retryDelay * attempt);
      }
    }

    throw new Error('Max retries exceeded');
  }
}
```

---

## API Integration

### New API Endpoints

```typescript
// packages/catalog-server/src/server.ts

// Queue chapter download
app.post("/api/offline/download/chapter", async (req, res) => {
  const { mangaId, chapterId, extensionId } = req.body;
  await offlineManager.queueChapterDownload(extensionId, mangaId, chapterId);
  res.json({ success: true });
});

// Queue manga download
app.post("/api/offline/download/manga", async (req, res) => {
  const { mangaId, chapterIds, extensionId } = req.body;
  await offlineManager.queueMangaDownload(extensionId, mangaId, chapterIds);
  res.json({ success: true });
});

// Get downloaded manga list
app.get("/api/offline/manga", async (req, res) => {
  const manga = await offlineManager.getDownloadedManga();
  res.json(manga);
});

// Get download queue status
app.get("/api/offline/queue", async (req, res) => {
  const queue = await offlineManager.getQueuedDownloads();
  res.json(queue);
});

// Delete chapter
app.delete("/api/offline/manga/:mangaId/chapters/:chapterId", async (req, res) => {
  await offlineManager.deleteChapter(req.params.mangaId, req.params.chapterId);
  res.json({ success: true });
});

// Get storage stats
app.get("/api/offline/storage", async (req, res) => {
  const totalSize = await offlineManager.getTotalStorageSize();
  const manga = await offlineManager.getDownloadedManga();
  res.json({ totalSize, mangaCount: manga.length });
});
```

---

## UI Components

### 1. Download Button (Manga Details Page)

```tsx
// src/components/offline/download-manga-button.tsx

interface DownloadMangaButtonProps {
  mangaId: string;
  mangaSlug: string;
  extensionId: string;
  chapterCount: number;
}

export function DownloadMangaButton({
  mangaId,
  mangaSlug,
  extensionId,
  chapterCount
}: DownloadMangaButtonProps) {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Check if already downloaded
  useEffect(() => {
    checkDownloadStatus();
  }, [mangaId]);

  const handleDownload = async () => {
    await queueMangaDownload(extensionId, mangaId);
    setIsDownloading(true);
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloaded || isDownloading}
      className="..."
    >
      {isDownloaded ? (
        <>✓ Downloaded</>
      ) : isDownloading ? (
        <>Downloading...</>
      ) : (
        <>Download All ({chapterCount} chapters)</>
      )}
    </button>
  );
}
```

### 2. Chapter Download Button

```tsx
// src/components/offline/download-chapter-button.tsx

export function DownloadChapterButton({
  mangaId,
  chapterId,
  extensionId
}: DownloadChapterButtonProps) {
  // Similar to manga button but for individual chapters
}
```

### 3. Offline Library Page

```tsx
// src/app/(app)/offline/page.tsx

export default async function OfflineLibraryPage() {
  const offlineManga = await getOfflineManga();

  return (
    <div>
      <h1>Offline Library</h1>
      <div className="grid">
        {offlineManga.map(manga => (
          <OfflineMangaCard key={manga.mangaId} manga={manga} />
        ))}
      </div>
    </div>
  );
}
```

### 4. Download Queue Manager

```tsx
// src/components/offline/download-queue.tsx

export function DownloadQueue() {
  const [queue, setQueue] = useState<QueuedDownload[]>([]);

  useEffect(() => {
    // Poll queue status every 2 seconds
    const interval = setInterval(fetchQueue, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 w-80">
      {queue.map(item => (
        <DownloadProgressCard key={item.id} download={item} />
      ))}
    </div>
  );
}
```

---

## Offline Reader Mode

The reader needs to detect offline mode and load from local storage.

```typescript
// src/components/reader/hooks/use-offline-pages.ts

export function useOfflinePages(mangaId: string, chapterId: string) {
  const [pages, setPages] = useState<PageImage[] | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    async function loadPages() {
      // Check if chapter is downloaded
      const metadata = await getOfflineChapterMetadata(mangaId, chapterId);

      if (metadata) {
        setIsOffline(true);
        // Convert local file paths to blob URLs
        const offlinePages = metadata.pages.map(page => ({
          index: page.index,
          url: `/api/offline/page/${mangaId}/${chapterId}/${page.filename}`,
          width: page.width,
          height: page.height
        }));
        setPages(offlinePages);
      }
    }

    loadPages();
  }, [mangaId, chapterId]);

  return { pages, isOffline };
}
```

Add API endpoint to serve offline images:

```typescript
// packages/catalog-server/src/server.ts

app.get("/api/offline/page/:mangaId/:chapterId/:filename", async (req, res) => {
  const { mangaId, chapterId, filename } = req.params;

  const filePath = offlineManager.getPagePath(mangaId, chapterId, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Page not found");
  }

  res.sendFile(filePath);
});
```

---

## Download Strategies

### Smart Download

1. **Priority Queue**: User-initiated downloads get higher priority
2. **Concurrent Limits**: Max 2 concurrent chapter downloads
3. **Bandwidth Throttling**: Optional speed limit to avoid hogging network
4. **Resume Support**: Failed downloads can be resumed from last page

### Auto-Download (Future)

- Download next chapter when user reaches 80% of current chapter
- Download all unread chapters for manga in "Continue Reading" list
- Schedule downloads during off-peak hours (e.g., midnight)

---

## Storage Management

### Auto-Cleanup

```typescript
interface CleanupPolicy {
  maxStorageBytes?: number;      // Delete oldest downloads when exceeded
  maxAgeUnreadDays?: number;     // Delete unread chapters older than X days
  keepReadChapters?: boolean;    // Keep chapters that have been read
}

async function enforceCleanupPolicy(policy: CleanupPolicy): Promise<void> {
  // 1. Check total storage size
  // 2. Sort chapters by: (read status, last accessed, download date)
  // 3. Delete oldest unread chapters until under limit
}
```

### Storage Stats

```typescript
interface StorageStats {
  totalBytes: number;
  mangaCount: number;
  chapterCount: number;
  pageCount: number;
  byExtension: Record<string, number>;
  byManga: Array<{ mangaId: string; title: string; bytes: number }>;
}
```

---

## Error Handling

### Retry Logic

- **Network errors**: Retry with exponential backoff (1s, 2s, 4s)
- **Server errors (5xx)**: Retry up to 3 times
- **Client errors (4xx)**: Fail immediately (page not found, forbidden, etc.)

### Partial Downloads

- If download interrupted, save progress in queue table
- On retry, skip already downloaded pages
- Delete partial downloads if user explicitly cancels

### Corruption Detection

- Verify image file integrity after download (check mime type, try to load)
- If corrupted, re-download that specific page
- Store checksum in metadata for future verification

---

## Implementation Timeline

**Phase 1: Core Infrastructure** (8-12 hours)
- ✅ Design schema and directory structure
- Create `offline-storage` package
- Implement `OfflineStorageManager` class
- Implement file system operations
- Add SQLite tables and repository

**Phase 2: Download Worker** (6-8 hours)
- Implement `DownloadWorker` class
- Implement `ImageDownloader` with retry logic
- Add queue processing logic
- Handle error cases and cleanup

**Phase 3: API Integration** (4-6 hours)
- Add API endpoints for download management
- Integrate with catalog server
- Add offline page serving endpoint

**Phase 4: UI Components** (8-12 hours)
- Download buttons on manga details page
- Individual chapter download buttons
- Download queue status widget
- Offline library page
- Storage management page

**Phase 5: Offline Reader** (4-6 hours)
- Detect offline chapters in reader
- Load pages from local storage
- Add offline indicator badge

**Total Estimate**: ~30-44 hours

---

## Future Enhancements

1. **Compression**: Store pages as WebP to save ~30-50% storage
2. **Batch Operations**: Download multiple manga at once
3. **Export/Import**: Share downloaded chapters with other devices
4. **Sync**: Cloud sync for offline library across devices
5. **Auto-Download**: Smart auto-download based on reading habits
