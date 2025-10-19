# Library and History Feature Implementation Plan

## Overview

This document outlines the implementation plan for the Library and History features in JAMRA. These features will leverage the existing reading progress and offline storage infrastructure.

## Current Infrastructure

### Existing Database Tables

- `reading_progress` - Tracks reading progress for each chapter (manga_id, chapter_id, current_page, total_pages, last_read_at)
- `offline_manga` - Tracks downloaded manga
- `offline_chapters` - Tracks downloaded chapters

### Existing Functionality

- Reading progress is already tracked in `packages/catalog-db/src/catalogRepository.ts`
- Methods: `saveReadingProgress()`, `getReadingProgress()`, `getAllReadingProgress()`, `getLatestReadingProgressPerManga()`
- Offline manga tracking in `packages/offline-storage`

## Library Feature

### Purpose

The Library is a curated collection of manga that the user is actively following or interested in. It should include:

- Manga the user is currently reading (has reading progress)
- Manga the user has downloaded for offline reading
- Manga the user has manually added to their library

### Database Schema

#### New Table: `library`

```sql
CREATE TABLE library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manga_id TEXT NOT NULL,
  extension_id TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  last_accessed_at INTEGER,
  status TEXT DEFAULT 'reading', -- 'reading', 'completed', 'plan_to_read', 'on_hold', 'dropped'
  favorite INTEGER DEFAULT 0,    -- Boolean for favorites
  notes TEXT,                     -- User notes
  UNIQUE(manga_id, extension_id)
);

CREATE INDEX idx_library_status ON library(status);
CREATE INDEX idx_library_favorite ON library(favorite);
CREATE INDEX idx_library_last_accessed ON library(last_accessed_at DESC);
```

### API Endpoints

```typescript
// Add manga to library
POST /api/library
Body: { extensionId, mangaId, status?, favorite? }
Response: { success: boolean, id: number }

// Get user's library
GET /api/library?status=reading&sort=last_accessed&order=desc
Response: {
  manga: Array<{
    id, extensionId, mangaId, status, favorite, addedAt, lastAccessedAt,
    details: MangaSummary,  // From cache
    progress?: { chapterId, currentPage, totalPages, lastReadAt },
    offline?: { downloadedChapters: number, totalChapters: number }
  }>
}

// Update library item
PATCH /api/library/:mangaId
Body: { status?, favorite?, notes? }
Response: { success: boolean }

// Remove from library
DELETE /api/library/:mangaId
Response: { success: boolean }

// Bulk operations
POST /api/library/bulk
Body: { action: 'add'|'remove'|'update', mangaIds: string[], updates?: {} }
Response: { success: boolean, affected: number }
```

### Auto-Population Logic

The library should be automatically populated based on:

1. **Reading Progress**: When a user reads a chapter, automatically add to library with status "reading"
2. **Offline Downloads**: When a user downloads chapters, add to library with appropriate status
3. **Manual Addition**: User explicitly adds via "Add to Library" button

### Frontend Components

#### Library Page (`src/app/(app)/library/page.tsx`)

- **Filter Bar**: Filter by status, favorites, offline availability
- **Sort Options**: Last accessed, title, date added, progress
- **Grid/List View**: Toggle between compact and detailed views
- **Quick Actions**: Mark as completed, change status, remove from library
- **Bulk Selection**: Select multiple manga for bulk operations

#### Library Card Component

```typescript
interface LibraryCardProps {
  manga: LibraryManga;
  view: "grid" | "list";
  onStatusChange: (status: LibraryStatus) => void;
  onFavoriteToggle: () => void;
  onRemove: () => void;
}
```

Display:

- Cover image
- Title and alt titles
- Current chapter / total chapters
- Progress bar (% read)
- Status badge
- Favorite star
- Offline indicator (if downloaded)
- Last read timestamp

## History Feature

### Purpose

History tracks all manga the user has viewed or interacted with, providing a chronological record of their activity.

### Database Schema

#### New Table: `history`

```sql
CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manga_id TEXT NOT NULL,
  extension_id TEXT NOT NULL,
  visited_at INTEGER NOT NULL,
  action TEXT NOT NULL,  -- 'viewed', 'read', 'searched', 'downloaded'
  chapter_id TEXT,       -- If action was 'read'
  page_number INTEGER,   -- If action was 'read'
  UNIQUE(manga_id, extension_id, visited_at)
);

CREATE INDEX idx_history_visited_at ON history(visited_at DESC);
CREATE INDEX idx_history_manga ON history(manga_id, extension_id);
CREATE INDEX idx_history_action ON history(action);
```

### API Endpoints

```typescript
// Get history
GET /api/history?limit=50&offset=0&action=read
Response: {
  history: Array<{
    id, mangaId, extensionId, visitedAt, action, chapterId?, pageNumber?,
    details: MangaSummary  // From cache or fetch
  }>,
  total: number,
  hasMore: boolean
}

// Add to history
POST /api/history
Body: { extensionId, mangaId, action, chapterId?, pageNumber? }
Response: { success: boolean, id: number }

// Clear history
DELETE /api/history?before=timestamp&action=viewed
Response: { success: boolean, deleted: number }

// Get history for specific manga
GET /api/history/:mangaId
Response: {
  history: Array<{ visitedAt, action, chapterId?, pageNumber? }>
}
```

### Auto-Tracking Logic

History should automatically track:

1. **Manga Views**: When user visits manga details page
2. **Chapter Reads**: When user reads a chapter (every N pages or on exit)
3. **Search Activity**: When user searches and clicks on results
4. **Downloads**: When user downloads chapters

### Frontend Components

#### History Page (`src/app/(app)/history/page.tsx`)

- **Timeline View**: Chronological list of activities
- **Filter Options**: By action type (viewed, read, downloaded)
- **Date Range Picker**: Filter by date range
- **Quick Actions**: Re-read, add to library, clear entry
- **Pagination**: Infinite scroll or page-based

#### History Item Component

```typescript
interface HistoryItemProps {
  entry: HistoryEntry;
  onClear: (id: number) => void;
  onAddToLibrary: () => void;
}
```

Display:

- Cover image (small)
- Title
- Action description ("Read Chapter 5", "Viewed", "Downloaded 3 chapters")
- Timestamp (relative: "2 hours ago", "Yesterday")
- Quick action buttons

## Implementation Phases

### Phase 1: Database & Backend (Priority: High)

1. Create migration script for new tables
2. Implement repository methods in `catalog-db`
3. Create API endpoints in `catalog-server`
4. Add auto-population hooks for reading progress and downloads
5. Write unit tests for repository methods

### Phase 2: Frontend - Library (Priority: High)

1. Create Library page with grid/list views
2. Implement filtering and sorting
3. Create Library card component
4. Add "Add to Library" button to manga details page
5. Integrate with offline storage indicators
6. Add bulk operations support

### Phase 3: Frontend - History (Priority: Medium)

1. Create History page with timeline view
2. Implement filtering by action type and date
3. Create History item component
4. Add auto-tracking for manga views
5. Add "Clear History" functionality

### Phase 4: Polish & Integration (Priority: Medium)

1. Add library stats to home page (total manga, chapters read, etc.)
2. Create library widget for sidebar
3. Add keyboard shortcuts for common actions
4. Implement export/import functionality (JSON)
5. Add search within library
6. Performance optimization for large libraries

## Database Migration Script

```typescript
// packages/catalog-db/src/migrations/003_library_and_history.ts
export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manga_id TEXT NOT NULL,
      extension_id TEXT NOT NULL,
      added_at INTEGER NOT NULL,
      last_accessed_at INTEGER,
      status TEXT DEFAULT 'reading',
      favorite INTEGER DEFAULT 0,
      notes TEXT,
      UNIQUE(manga_id, extension_id)
    );

    CREATE INDEX IF NOT EXISTS idx_library_status ON library(status);
    CREATE INDEX IF NOT EXISTS idx_library_favorite ON library(favorite);
    CREATE INDEX IF NOT EXISTS idx_library_last_accessed ON library(last_accessed_at DESC);

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manga_id TEXT NOT NULL,
      extension_id TEXT NOT NULL,
      visited_at INTEGER NOT NULL,
      action TEXT NOT NULL,
      chapter_id TEXT,
      page_number INTEGER,
      UNIQUE(manga_id, extension_id, visited_at)
    );

    CREATE INDEX IF NOT EXISTS idx_history_visited_at ON history(visited_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_manga ON history(manga_id, extension_id);
    CREATE INDEX IF NOT EXISTS idx_history_action ON history(action);
  `);
}

export function down(db: Database) {
  db.exec(`
    DROP TABLE IF EXISTS library;
    DROP TABLE IF EXISTS history;
  `);
}
```

## Integration with Existing Features

### Reading Progress Integration

- When `saveReadingProgress()` is called, automatically add/update library entry
- Update `last_accessed_at` timestamp
- If user completes a manga (read all chapters), suggest changing status to "completed"

### Offline Storage Integration

- When manga is downloaded, add to library if not already present
- Show offline indicator on library cards
- Filter library by "Downloaded" status
- Sync library status with offline downloads

### Continue Reading Integration

- Home page "Continue Reading" widget should pull from library items with status "reading"
- Sort by `last_accessed_at` to show most recently read first
- Show progress percentage based on chapters read vs total chapters

## Future Enhancements

1. **Collections**: Group manga into custom collections (e.g., "Action", "To Binge", "Favorites")
2. **Reading Goals**: Set goals for chapters/manga to read per week/month
3. **Statistics**: Detailed reading statistics (chapters read per day, favorite genres, etc.)
4. **Social Features**: Share library with friends, see what others are reading
5. **Recommendations**: Based on library content and reading history
6. **Cloud Sync**: Sync library and history across devices
7. **Backup/Restore**: Export and import library data

## Notes

- Library and History should be opt-in features with privacy controls
- Consider GDPR compliance for history tracking
- Implement data retention policies (auto-delete history older than X months)
- Add user preferences for auto-population behavior
- Ensure proper indexing for performance with large datasets (10,000+ entries)
