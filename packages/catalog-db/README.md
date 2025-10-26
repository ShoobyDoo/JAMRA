# JAMRA Catalog DB

SQLite persistence layer for JAMRA’s catalogue metadata, chapter listings, page assets, and extension-scoped caches.

## Features

- Opens a WAL-enabled SQLite database located under `JAMRA_DATA_DIR` (defaults to `.jamra-data/catalog.sqlite`).
- Applies schema migrations on first run, creating tables for extensions, manga, chapters, pages, and cache entries.
- Provides helper methods to upsert manifests, catalogue summaries, chapters, and chapter-page payloads.

## Usage

```ts
import {
  CatalogDatabase,
  ExtensionRepository,
  MangaRepository,
  ChapterRepository,
} from "@jamra/catalog-db";

const db = new CatalogDatabase();

// Use individual repositories for focused operations
const extensionRepo = new ExtensionRepository(db.db);
const mangaRepo = new MangaRepository(db.db);
const chapterRepo = new ChapterRepository(db.db);

extensionRepo.upsertExtension(manifest);
mangaRepo.upsertMangaSummaries(manifest.id, catalogue.items);
chapterRepo.upsertChapters(manifest.id, mangaId, chapters);
```

Available repositories:
- `ExtensionRepository` - Extension installation and metadata
- `MangaRepository` - Manga summaries and details
- `ChapterRepository` - Chapter lists and page data
- `LibraryRepository` - User library and reading lists
- `ReadingProgressRepository` - Chapter reading progress
- `HistoryRepository` - Reading history tracking
- `CoverCacheRepository` - Cached cover images
- `SettingsRepository` - App settings and preferences
