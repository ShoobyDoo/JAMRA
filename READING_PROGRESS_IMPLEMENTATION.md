# Reading Progress Implementation

## Overview
Implemented database-backed reading progress tracking that syncs progress across sessions. Every page change is automatically saved to the SQLite database via the API.

## Changes Made

### 1. Database Layer (`packages/catalog-db/`)

#### Migration (src/migrations.ts)
- **Added migration #6**: Created `reading_progress` table
  - Columns: `manga_id`, `chapter_id`, `current_page`, `total_pages`, `scroll_position`, `last_read_at`
  - Primary key: `(manga_id, chapter_id)`
  - Index on `last_read_at DESC` for "Continue Reading" feature

#### Repository (src/catalogRepository.ts)
- **`saveReadingProgress()`**: Upserts progress to database
- **`getReadingProgress()`**: Fetches progress for a specific manga/chapter
- **`getAllReadingProgress()`**: Returns all progress sorted by `last_read_at`

### 2. API Layer (`packages/catalog-server/`)

#### Endpoints (src/server.ts)
- **POST `/api/reading-progress`**: Save progress
  - Body: `{ mangaId, chapterId, currentPage, totalPages, scrollPosition }`
  - Returns: `{ success: true }`

- **GET `/api/reading-progress/:mangaId/:chapterId`**: Get progress for specific chapter
  - Returns: `ReadingProgressData` or 404

- **GET `/api/reading-progress`**: Get all progress (for Continue Reading feature)
  - Returns: `ReadingProgressData[]`

### 3. Frontend API Client (`src/lib/api.ts`)

#### New Functions
- **`saveReadingProgress()`**: Calls POST endpoint
- **`getReadingProgress()`**: Calls GET endpoint (returns null on 404)
- **`getAllReadingProgress()`**: Calls GET all endpoint

#### Type
```typescript
interface ReadingProgressData {
  mangaId: string;
  chapterId: string;
  currentPage: number;
  totalPages: number;
  lastReadAt: number;
}
```

### 4. State Management (`src/store/reading-progress.ts`)

#### Changes
- **Hybrid approach**: Uses both localStorage (fast) and API (persistent)
- **`setProgress()`**: Now saves to API (fire-and-forget, non-blocking)
- **`setCurrentPage()`**: Saves to API on every page change
- **`loadProgressFromAPI()`**: New async method to fetch from API
- **`setCurrentChapter()`**: Now async - tries API first, falls back to localStorage

#### Flow
1. User opens chapter → `setCurrentChapter()` called
2. Loads from API (if available), otherwise uses localStorage
3. User navigates pages → `setCurrentPage()` called
4. Saves to both localStorage AND API simultaneously
5. API saves are non-blocking (fire-and-forget with error logging)

### 5. Reader Hook (`src/components/reader/hooks/use-reader-progress.ts`)

#### Changes
- Updated to handle async `setCurrentChapter()`
- Wrapped initialization in async function to await API load
- Maintains backward compatibility with `initialPage` prop

### 6. Previous Chapter Navigation Fix

#### Problem
When navigating to previous chapter, it loaded saved progress instead of last page

#### Solution
- Added `?page=last` URL parameter when navigating to previous chapter
- Reader page parses parameter and sets `initialPage` prop
- After initial load, removes query parameter using `router.replace()`
- Prevents refresh from re-triggering last page load

#### Files Modified
- `src/components/reader/reading-modes/paged-mode.tsx`
- `src/components/reader/reading-modes/dual-page-mode.tsx`
- `src/components/reader/reading-modes/vertical-mode.tsx`
- `src/app/read/[slug]/chapter/[number]/page.tsx`
- `src/components/reader/manga-reader.tsx`

### 7. Chapter Navigation Enhancements

#### Previous Chapter Navigation
- All modes now show clickable "Previous Chapter" indicator on first page
- Paged/Dual: Left side button with chapter info
- Vertical: Top button with upward chevron

#### Next Chapter Navigation
- All modes show next chapter or "End of Manga" on last page
- Paged/Dual: Right side button or end message
- Vertical: Bottom button or end message
- Clicking advances to next chapter or shows completion

## Testing

### To Test Progress Persistence
1. Start reading a chapter (e.g., Chapter 1, page 1)
2. Navigate to page 2
3. Close browser/clear localStorage
4. Reopen chapter → should resume at page 2 (loaded from database)

### To Test Previous Chapter Navigation
1. Go to Chapter 3
2. Click "Previous Chapter" button
3. Should load Chapter 2 at last page (3/3)
4. Scroll to page 1
5. Refresh browser → should stay at page 1 (not jump back to page 3)

### To Test Cross-Session Sync
1. Read Chapter 1 to page 2 on device A
2. Open same chapter on device B (or new browser)
3. Should start at page 2 (synced from database)

## Architecture Decisions

### Why Hybrid (localStorage + API)?
- **localStorage**: Instant reads, no API delay on page load
- **API**: Persistent across devices/sessions, survives browser data clearing
- **Fire-and-forget saves**: Don't block UI, gracefully handle failures

### Why Non-Blocking API Saves?
- User experience priority - page navigation must feel instant
- Progress loss on failure is acceptable (localStorage backup exists)
- Errors logged to console for debugging

### Why Keep scroll_position in DB?
- Column exists in database for future use
- Currently always set to 0
- Can be enabled later without migration

## Future Enhancements

### Continue Reading Feature
Use `getAllReadingProgress()` to show:
- Recently read manga on home page
- Progress bars (current page / total pages per chapter)
- "Continue from page X" buttons

### Cross-Device Sync
- Already works with current implementation
- Just need to ensure API is accessible across devices

### Offline Support
- Currently requires API for initial load
- Could enhance with Service Worker + IndexedDB
- Sync queue for offline saves

## Files Changed

### Backend
- `packages/catalog-db/src/migrations.ts`
- `packages/catalog-db/src/catalogRepository.ts`
- `packages/catalog-server/src/server.ts`

### Frontend
- `src/lib/api.ts`
- `src/store/reading-progress.ts`
- `src/components/reader/hooks/use-reader-progress.ts`
- `src/components/reader/manga-reader.tsx`
- `src/components/reader/reading-modes/paged-mode.tsx`
- `src/components/reader/reading-modes/dual-page-mode.tsx`
- `src/components/reader/reading-modes/vertical-mode.tsx`
- `src/app/read/[slug]/chapter/[number]/page.tsx`

### Navigation Enhancements
- Added chapter navigation indicators to all reading modes
- Fixed "Previous Chapter" to load at last page
- Added "End of Manga" messaging
- Removed page markers (vertical lines on progress bar) as requested

## Known Limitations

1. **No conflict resolution**: Last write wins if reading same chapter on multiple devices
2. **No offline queue**: API saves fail silently when offline (localStorage fallback works)
3. **No progress merge**: Doesn't merge progress from different devices intelligently
4. **scroll_position unused**: Database column exists but not actively tracked

## Migration Notes

- Database migration #6 runs automatically on server start
- Existing installations will get new `reading_progress` table
- No data loss - existing localStorage progress remains as fallback
- Backward compatible - works with and without database
