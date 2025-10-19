# JAMRA Architecture Summary - History Feature Planning

## Current Architecture Overview

### 1. Database Schema (SQLite via better-sqlite3)

#### Existing Tracking Tables

**reading_progress** (Migration #6)

- Primary Key: `(manga_id, chapter_id)`
- Columns:
  - `manga_id`: TEXT (Foreign Key → manga.id)
  - `chapter_id`: TEXT (Foreign Key → chapters.id)
  - `current_page`: INTEGER (0-indexed current page)
  - `total_pages`: INTEGER
  - `scroll_position`: INTEGER (currently unused, always 0)
  - `last_read_at`: INTEGER (milliseconds timestamp, indexed DESC)
- Indexed by: `last_read_at DESC` for efficient sorting
- Used for: Tracking reading progress within chapters

**library_entries** (Migration #10)

- Primary Key: `manga_id`
- Columns:
  - `manga_id`, `extension_id`, `status` (reading/plan_to_read/completed/on_hold/dropped)
  - `personal_rating`, `favorite`, `notes`
  - `added_at`, `updated_at`, `started_at`, `completed_at` (all INTEGER timestamps)
- Multiple indexes on: status, favorite, added_at DESC, updated_at DESC
- Used for: User library management and manga lifecycle tracking

**library_tags** (Migration #10)

- Allows tagging of manga for organization
- Used for: Categorizing library entries

**manga** (Core table)

- Stores manga metadata cached from extensions
- Key fields: `id`, `title`, `description`, `cover_url`, `status`, etc.
- Index on `extension_id`, `updated_at`

**chapters** (Core table)

- Stores chapter metadata
- Foreign Keys: `manga_id`, `extension_id`
- Indexed by: `manga_id` for efficient chapter queries

#### NO EXISTING HISTORY TABLE

- Currently only `reading_progress` tracks reading activity
- No dedicated history/audit table
- No deletion history or other tracking

### 2. Backend API Layer (Express.js via catalog-server)

#### Current Reading Progress Endpoints (Lines 1443-1624 in server.ts)

**POST /api/reading-progress**

- Request: `{ mangaId, chapterId, currentPage, totalPages, scrollPosition }`
- Saves progress atomically via `repository.saveReadingProgress()`
- DB operation: INSERT ... ON CONFLICT DO UPDATE

**GET /api/reading-progress/:mangaId/:chapterId**

- Retrieves specific chapter progress
- Returns: `ReadingProgressData`

**GET /api/reading-progress**

- Returns all reading progress entries
- Used by: ContinueReadingButton for "Continue Reading" feature

**GET /api/reading-progress/enriched?limit=N**

- Returns paginated, enriched progress with manga details
- Hydrates: Fetches manga metadata for each progress entry
- Used by: Home page "Continue Reading" section
- Flow:
  1. Gets latest reading progress per manga (limited)
  2. Filters to unique manga IDs
  3. Fetches manga details in parallel
  4. Returns enriched data with full manga info

#### Library Management Endpoints (Lines 1626-1933)

**POST /api/library** - Add manga to library
**PUT /api/library/:mangaId** - Update library entry (status, rating, notes, etc.)
**GET /api/library** - List library entries with filters
**GET /api/library-enriched** - Enriched library data with manga details
**GET /api/library-stats** - Statistics about library (counts by status, etc.)

#### Repository Methods (CatalogRepository)

**saveReadingProgress(mangaId, chapterId, currentPage, totalPages, scrollPosition)**

- DB insert/update operation
- Timestamps: `last_read_at` set to `now()`
- Used by: Server endpoint `/api/reading-progress`

**getReadingProgress(mangaId, chapterId)**

- Single chapter progress lookup

**getAllReadingProgress()**

- Returns all progress entries ordered by `last_read_at DESC`

**getLatestReadingProgressPerManga()**

- SQL: Partition by manga_id, get latest by last_read_at for each
- Returns: Most recent chapter read for each manga
- Used by: Home page "Continue Reading" (enriched endpoint)

**getEnrichedLibraryEntries(filters?)**

- Joins library_entries with manga table
- Calculates: totalChapters, readChapters (distinct from reading_progress)
- Used for: Library UI with progress bars

### 3. Frontend State Management (Zustand)

#### useReadingProgress Store (src/store/reading-progress.ts)

- **Persisted State**: `progress: Record<string<mangaId:chapterId> -> ReadingProgress>`
- **Session State**: `currentMangaId`, `currentChapterId`, `currentPage`, `totalPages`
- **Key Actions**:
  - `setProgress(mangaId, chapterId, page, total)` - Updates progress + API call (fire-and-forget)
  - `setCurrentChapter()` - Loads from API first, falls back to localStorage
  - `setCurrentPage()` - Atomic update + API save
  - `markChapterComplete()` - Sets page to totalPages
- **Persistence**: Uses zustand/middleware with localStorage key `reading-progress-storage`

#### useLibrary Store (src/store/library.ts)

- **Data**: `entries: Map<mangaId -> EnrichedLibraryEntry>`, `tags`, `stats`
- **UI State**: `filters`, `sortBy`, `sortOrder`, `isLoading`, `error`
- **Selection**: `selectedMangaIds: Set<string>` for bulk operations
- **Key Actions**:
  - `addToLibrary()`, `updateEntry()`, `removeEntry()`
  - `loadLibrary()`, `loadStats()`, `loadTags()`
  - `setFilters()`, `setSortBy()`
  - Computed: `getFilteredEntries()`, `getSortedEntries()`, `getEntryByMangaId()`

### 4. Frontend Components & Pages

#### Home Page (src/app/(app)/(public)/page.tsx)

- Fetches enriched reading progress (max 12 items)
- Falls back to `hydrateProgressWithDetails()` if enriched endpoint fails
- Renders two sections:
  1. **Available Manga**: Can be loaded (extension enabled)
  2. **Unavailable Manga**: Extension missing/disabled
- Uses: `ContinueReadingCard` component

#### Continue Reading Button (src/components/manga/continue-reading-button.tsx)

- Used on manga detail pages
- Finds most recently read chapter for specific manga
- Shows "Start Reading" or "Continue Reading" with:
  - Chapter title
  - Current page / total pages
  - Progress percentage
- Filters: Only shows chapters available in passed list

#### Library Page (implicitly in src/app/(app)/(account)/library/)

- Uses `useLibrary` store
- Displays enriched entries with filters and sorting
- Shows progress bars (readChapters / totalChapters)

### 5. Data Flow for "Continue Reading"

```
User views Home Page
    ↓
GET /api/reading-progress/enriched?limit=12
    ↓
Server: getLatestReadingProgressPerManga() → window of 12 most recent
    ↓
Server: Parallel fetches of manga details for each unique manga_id
    ↓
Response: EnrichedReadingProgress[] with manga data
    ↓
Frontend: Render ContinueReadingCard for each item
    ↓
User clicks card → Navigate to /read/[slug]/chapter/[chapterSlug]?page=X
```

## Current "History" Implementation

### What Currently Exists:

1. **Reading Progress Tracking**: Times and pages read are stored (`last_read_at` in reading_progress)
2. **Reading History Hydration** (src/lib/reading-history.ts):
   - `selectHistoryWindow()`: Selects top 12 most recent from reading_progress
   - `hydrateProgressWithDetails()`: Enriches progress with manga details
   - Uses React `cache()` for request deduplication
3. **Home Page Display**: "Continue Reading" Netflix-style UI showing recent reading

### What's Missing:

1. **No explicit "History" page or section**
2. **No history filtering/sorting beyond "most recent"**
3. **No history timestamps** beyond `last_read_at`
4. **No history volume/metrics**: total chapters read, time reading, etc.
5. **No history export/import**
6. **No history privacy controls**

## API Structure & Patterns

### Response Format Pattern:

```typescript
// Success:
{
  success: true,
  data: [...],
  // or
  error: null
}

// Error (via handleError):
{
  error: "User-friendly message",
  detail: "Technical details"
}
```

### Pagination Pattern:

- Query param: `?page=1&limit=50`
- Response includes: `page`, `hasMore`, `items`

### Filter Pattern:

- URL query params: `?status=reading&favorite=true`
- Complex filters: `?filters={"genre":"action"}`

### Timestamp Pattern:

- Unix milliseconds (Date.now())
- Stored and returned as numbers
- Frontend converts to dates as needed

## Type System

### Database Layer Types (catalogRepository.ts):

- `StoredExtension`, `StoredMangaDetails`
- All database operations return TypeScript-typed objects
- Database returns camelCase via SELECT aliases

### API Layer Types (api.ts):

- `ReadingProgressData`: Core reading data
- `EnrichedReadingProgress`: ReadingProgressData + manga details + extensionId
- `EnrichedLibraryEntry`: Library entry + manga data + chapter counts

### Frontend Types:

- Zustand stores define interface contracts
- Component props are explicitly typed
- No implicit `any` types (TypeScript strict mode)

## Build & Deployment Structure

### Monorepo Package Dependency Order:

1. `@jamra/extension-sdk` - Base interfaces
2. `@jamra/catalog-db` - SQLite persistence (CatalogRepository)
3. `@jamra/catalog-service` - Business logic
4. `@jamra/catalog-server` - HTTP API (depends on all above)
5. Next.js frontend - Consumes catalog-server API

### Key Build Notes:

- `pnpm backend:build` - Builds all backend packages in parallel
- `pnpm lint` - Must run after all changes
- SQLite bindings auto-refresh on `pnpm install`

## Relevant Patterns for History Feature

### 1. Database Migration Pattern:

- New migration increments ID
- Checks for existing columns with PRAGMA
- Adds columns only if not exists
- Example: Migration #8 added `slug` column

### 2. Repository Pattern:

- All DB access via CatalogRepository methods
- Methods handle serialization/deserialization (JSON)
- Prepared statements with parameter binding
- Transactions for atomicity

### 3. API Endpoint Pattern:

- Route handler validates input
- Calls repository method
- Catches errors and uses `handleError()`
- Returns JSON response

### 4. Zustand Store Pattern:

- `create()` wrapper with middleware
- Actions that call API and update local state
- Computed getters for derived data
- `persist` middleware for localStorage

### 5. Component Pattern:

- Server components for initial data fetch
- Client components (`"use client"`) for interactions
- Mantine UI for components
- Lucide React for icons

## Limitations & Constraints

### Current Limitations:

1. **Reading progress tied to chapters**: Can't track progress at non-chapter level
2. **No session-based tracking**: Only persistent data (no temporary views)
3. **Limited retention**: No automatic cleanup of old progress
4. **No pagination** for reading progress endpoints
5. **Heavy enrichment**: Enriched endpoint does parallel DB fetches
6. **No caching** of enriched data beyond React `cache()`

### Database Constraints:

- SQLite: File-based, not distributed
- Foreign Keys: Cascading deletes configured
- Unique Constraints: composite on various fields

### API Constraints:

- No authentication/authorization layer
- No rate limiting
- CORS enabled globally
- No request logging for auditing

## Recommendations for History Feature

### Phase 1: Extend Current System

1. Add `history_entries` table (similar to reading_progress but with more metadata)
2. Track: manga_id, chapter_id, action_type (read_chapter, bookmarked, rated, etc.), timestamp
3. Index on: timestamp DESC for efficient queries
4. Add API endpoint: `GET /api/history?limit=50&offset=0` with pagination

### Phase 2: History UI

1. Create `/history` page
2. Add filtering: date range, manga, action type
3. Add sorting: newest first, oldest first, by manga
4. Display timeline view or list view

### Phase 3: Advanced Features

1. History statistics: "Read X chapters in Y time"
2. Export history as CSV/JSON
3. Privacy controls: "Clear history before X date"
4. Search within history: "Show all reads for manga X"

### Implementation Considerations:

- Use same migration pattern (increment migration ID)
- Use same repository/API/store patterns
- Consider composite index on (manga_id, timestamp DESC) for efficient queries
- Add cleanup job for old history (optional retention policy)
- Consider separate table vs. adding to reading_progress for GDPR compliance
