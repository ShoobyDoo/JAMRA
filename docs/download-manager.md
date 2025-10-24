# Download Manager Documentation

**Version:** 1.0.0
**Last Updated:** 2025-10-24
**Status:** Production Ready

## Overview

The Download Manager is a comprehensive offline manga management system that enables users to download, organize, archive, and manage their manga collection for offline reading. It provides three distinct interfaces for managing downloads at different stages of their lifecycle.

## Table of Contents

1. [Architecture](#architecture)
2. [Features](#features)
3. [User Interface](#user-interface)
4. [API Reference](#api-reference)
5. [Technical Implementation](#technical-implementation)
6. [Known Limitations](#known-limitations)
7. [Future Enhancements](#future-enhancements)

## Architecture

### Component Structure

```
src/app/(app)/downloads/
└── page.tsx                          # Main downloads page with tab navigation

src/components/downloads/
├── downloads-queue-section.tsx       # Active downloads tab
├── downloads-history-section.tsx     # Download history tab
├── manager-tab.tsx                   # Offline library manager
├── storage-dashboard.tsx             # Storage statistics visualization
├── offline-manga-list.tsx            # Manga library grid/list view
├── offline-search.tsx                # Search and filter component
├── bulk-actions-toolbar.tsx          # Bulk operations toolbar
├── archive-dialog.tsx                # Archive/export dialog
├── import-dialog.tsx                 # Import from ZIP dialog
├── metadata-editor-dialog.tsx        # Metadata editor dialog
├── storage-settings.tsx              # Storage management settings
└── scheduler-panel.tsx               # Download scheduler settings

packages/offline-storage/src/
├── archiver.ts                       # ZIP archive creation
├── importer.ts                       # ZIP import and extraction
├── cleanup.ts                        # Storage cleanup utilities
└── manager.ts                        # Core offline storage manager
```

### Data Flow

```
User Action → Frontend Component → API Endpoint → Backend Service → Database/Filesystem
                                                                    ↓
User Notification ← Frontend Update ← SSE/Response ← Backend Event ←
```

## Features

### 1. Active Downloads Tab

Monitor and manage downloads currently in progress.

**Features:**
- Real-time progress tracking via Server-Sent Events (SSE)
- Download queue visualization
- Grouping options: by manga, extension, status, or none
- Status filtering: all, queued, downloading, failed, frozen
- Bulk selection with keyboard shortcuts (Ctrl+A, Shift+Click, Delete)
- Actions: Cancel, Retry, Resume frozen downloads

**Technical Details:**
- Component: `downloads-queue-section.tsx`
- Updates: Real-time via SSE from `/api/offline/events`
- State Management: React hooks with optimistic updates

### 2. History Tab

View and manage completed download history.

**Features:**
- Search by manga/chapter title (300ms debounced)
- Status filter: All, Completed, Failed
- Sort options: Newest First, Oldest First
- Date grouping: Today, This Week, This Month, Older
- Collapsible date groups with counts
- Actions: Delete individual items, Clear all history

**Technical Details:**
- Component: `downloads-history-section.tsx`
- API: `GET /api/offline/history`
- Pagination: Limited to configurable number of items

### 3. Manager Tab - Storage Dashboard

Comprehensive overview of offline storage usage.

**Features:**
- 4 summary cards:
  - Total storage used
  - Offline manga count
  - Total chapters count
  - Average size per chapter
- Storage by extension breakdown with progress bars
- Top 10 largest manga ranked list
- Loading skeleton states
- Empty state with actionable suggestions

**Technical Details:**
- Component: `storage-dashboard.tsx`
- API: `GET /api/offline/stats`
- Update Frequency: On load and after modifications

### 4. Manager Tab - Search & Filter

Advanced search and filtering capabilities.

**Features:**
- Debounced text search (300ms delay)
- Multi-select extension filter
- Size range filter (min/max in MB)
- Date range filter (downloaded within X days)
- Active filter chips with quick remove
- Responsive design (wraps on small screens)

**Technical Details:**
- Component: `offline-search.tsx`
- Implementation: Client-side filtering for instant results
- Memoization: Uses React.useMemo for performance

### 5. Manager Tab - Offline Library

Grid or list view of downloaded manga with management options.

**Features:**
- View modes: Grid (cards) or List (compact)
- Selection: Individual manga, individual chapters, select all
- Expandable chapter lists per manga
- Context menu actions:
  - Delete manga (with confirmation)
  - Delete chapter
  - Edit metadata
- Enhanced empty state with quick actions
- Filtered count display

**Technical Details:**
- Component: `offline-manga-list.tsx`
- State: Selection tracked via Set data structure
- Performance: Virtualization for large lists

### 6. Bulk Operations

Perform actions on multiple items simultaneously.

**Features:**
- Fixed position toolbar at bottom of screen
- Selection count and total count display
- Bulk delete (manga + chapters)
- Bulk archive (currently single manga only)
- Clear selection

**Technical Details:**
- Component: `bulk-actions-toolbar.tsx`
- Position: Fixed at bottom with backdrop
- Visibility: Only shown when items selected

### 7. Archive/Export System

Export manga to ZIP files for backup or sharing.

**Features:**
- Archive options:
  - Include metadata toggle
  - Include cover image toggle
  - Compression level (0-9 slider)
- Progress tracking during archive creation
- Automatic download when complete
- Support for partial archives (selected chapters only)

**Technical Details:**
- Frontend: `archive-dialog.tsx`
- Backend: `archiver.ts`, uses `archiver` npm package
- API: `POST /api/offline/archive`
- Download: `GET /api/offline/archive/download/:filename`
- **Limitation:** Currently supports single manga per archive

**Archive Structure:**
```
manga-title-timestamp.zip
├── metadata.json              # Manga metadata
├── cover.jpg                  # Cover image (if included)
└── chapters/
    ├── chapter-001/
    │   ├── metadata.json      # Chapter metadata
    │   └── pages/
    │       ├── 001.jpg
    │       ├── 002.jpg
    │       └── ...
    └── chapter-002/
        └── ...
```

### 8. Import System

Import manga from ZIP archives created by the export system or other sources.

**Features:**
- File upload with drag-and-drop
- Automatic validation before import
- Archive structure validation
- Conflict resolution options:
  - Skip existing (keep current)
  - Overwrite existing (replace)
  - Rename (add suffix like "-imported")
- SSE progress tracking
- Detailed result reporting

**Technical Details:**
- Frontend: `import-dialog.tsx`
- Backend: `importer.ts`, uses `extract-zip` npm package
- API: `POST /api/offline/import/validate`, `POST /api/offline/import`
- Upload: Multer middleware, 500MB file size limit
- Validation: Checks for metadata.json, proper structure

### 9. Metadata Editor

Edit manga metadata for offline copies.

**Features:**
- Editable fields:
  - Title (text input)
  - Description (textarea, auto-growing)
  - Authors (comma-separated)
  - Artists (comma-separated)
- Original values reference display
- Unsaved changes confirmation
- Immediate visual feedback

**Technical Details:**
- Component: `metadata-editor-dialog.tsx`
- API: `PATCH /api/offline/metadata/:extensionId/:mangaId`
- Validation: Field-level validation on backend
- **Note:** Changes only affect offline copy, not source

### 10. Storage Settings

Configure storage limits and automatic cleanup.

**Features:**
- Storage limit configuration (in GB)
- Auto-cleanup toggle
- Cleanup strategies:
  - Oldest downloads first
  - Largest files first
  - Least recently accessed
- Cleanup threshold percentage (50-95%)
- Visual storage usage progress bar
- Color-coded warnings (blue < 75%, yellow < 90%, red ≥ 90%)
- Manual "Run Cleanup Now" button

**Technical Details:**
- Component: `storage-settings.tsx`
- Backend: `cleanup.ts`
- API: `GET/PUT /api/offline/settings`, `POST /api/offline/cleanup`
- Storage: Settings saved to `.jamra-data/.settings/storage.json`
- Cleanup: Deletes entire manga directories based on strategy

**Cleanup Algorithm:**
1. Check if usage exceeds threshold
2. Sort manga by selected strategy
3. Delete manga in order until target free space achieved
4. Return statistics (freed bytes, items removed, errors)

### 11. Download Scheduler

Control when downloads are allowed to run.

**Features:**
- Enable/disable scheduler toggle
- Download time window configuration:
  - Start hour (0-23, 12-hour format display)
  - End hour (0-23, 12-hour format display)
- Bandwidth limit (MB/s, 0 = unlimited)
- Pause during active reading toggle
- Real-time status indicator
- Current time display with allowed/paused status

**Technical Details:**
- Component: `scheduler-panel.tsx`
- API: `GET/PUT /api/offline/scheduler`
- Storage: Settings saved to `.jamra-data/.settings/scheduler.json`
- **Note:** Scheduler settings are saved but enforcement is not yet implemented in download worker

## User Interface

### Navigation

Access the Download Manager via:
- Sidebar navigation: "Downloads" icon
- Direct URL: `/downloads`

### Keyboard Shortcuts

#### Active Downloads Tab
- `Ctrl/Cmd + A` - Select all downloads
- `Delete` - Cancel selected downloads
- `Escape` - Clear selection
- `Shift + Click` - Range selection
- `Ctrl/Cmd + Click` - Toggle individual selection

#### Manager Tab
- Standard browser shortcuts for text input
- `Escape` - Close dialogs/modals

### Responsive Design

- **Desktop (≥1024px):** Full feature set, multi-column layouts
- **Tablet (768-1023px):** Adjusted layouts, some columns collapse
- **Mobile (<768px):** Single column, touch-optimized controls

## API Reference

### Download Queue

#### Get Queue
```http
GET /api/offline/queue
```
Returns current download queue with progress information.

**Response:**
```json
[
  {
    "id": 1,
    "extensionId": "com.weebcentral.manga",
    "mangaId": "01J76XYGY7FDV857J4HJAZ131K",
    "chapterId": "01JP2W38N2ZKW803FP9HSTYH5K",
    "status": "downloading",
    "progressCurrent": 15,
    "progressTotal": 24,
    "startedAt": 1698765432000,
    "queuedAt": 1698765400000
  }
]
```

### Download History

#### Get History
```http
GET /api/offline/history?limit=100
```
Returns download history entries.

**Query Parameters:**
- `limit` (optional): Maximum number of entries (default: 100)

### Storage

#### Get Storage Stats
```http
GET /api/offline/stats
```
Returns storage statistics.

**Response:**
```json
{
  "totalBytes": 1234567890,
  "mangaCount": 42,
  "chapterCount": 568,
  "pageCount": 12543,
  "byExtension": {
    "com.weebcentral.manga": 987654321
  },
  "byManga": [
    {
      "mangaId": "...",
      "title": "One Piece",
      "chapterCount": 50,
      "totalBytes": 123456789
    }
  ]
}
```

#### Get Offline Manga List
```http
GET /api/offline/manga
```
Returns list of all offline manga with metadata.

#### Delete Offline Manga
```http
DELETE /api/offline/manga/:extensionId/:mangaId
```
Deletes manga and all its chapters from offline storage.

#### Delete Offline Chapter
```http
DELETE /api/offline/chapter/:extensionId/:mangaId/:chapterId
```
Deletes a specific chapter from offline storage.

### Archive

#### Create Archive
```http
POST /api/offline/archive
Content-Type: application/json

{
  "items": [
    {
      "extensionId": "com.weebcentral.manga",
      "mangaId": "01J76XYGY7FDV857J4HJAZ131K",
      "chapterIds": ["01JP2W38N2ZKW803FP9HSTYH5K"] // optional
    }
  ],
  "options": {
    "includeMetadata": true,
    "includeCover": true,
    "compressionLevel": 6
  }
}
```

**Response:**
```json
{
  "success": true,
  "downloadUrl": "/api/offline/archive/download/manga-title-1698765432000.zip",
  "sizeBytes": 123456789
}
```

**Note:** Currently only supports single manga (items.length === 1)

#### Download Archive
```http
GET /api/offline/archive/download/:filename
```
Downloads the created archive file.

### Import

#### Validate Archive
```http
POST /api/offline/import/validate
Content-Type: multipart/form-data

file: [ZIP file]
```

**Response:**
```json
{
  "valid": true,
  "manga": {
    "title": "One Piece",
    "chapterCount": 50
  },
  "errors": []
}
```

#### Import Archive
```http
POST /api/offline/import
Content-Type: multipart/form-data

file: [ZIP file]
conflictResolution: "skip" | "overwrite" | "rename"
```

**Response:** Server-Sent Events stream
```
data: {"type":"progress","progress":25,"message":"Extracting files..."}
data: {"type":"progress","progress":50,"message":"Validating structure..."}
data: {"type":"complete","result":{"success":true,"imported":true}}
```

### Metadata

#### Update Metadata
```http
PATCH /api/offline/metadata/:extensionId/:mangaId
Content-Type: application/json

{
  "title": "New Title",
  "description": "Updated description",
  "authors": ["Author 1", "Author 2"],
  "artists": ["Artist 1"]
}
```

**Response:**
```json
{
  "success": true,
  "metadata": { /* updated metadata object */ }
}
```

**Allowed Fields:** `title`, `description`, `authors`, `artists`

### Storage Settings

#### Get Settings
```http
GET /api/offline/settings
```

**Response:**
```json
{
  "maxStorageGB": 10,
  "autoCleanupEnabled": false,
  "cleanupStrategy": "oldest",
  "cleanupThresholdPercent": 90
}
```

#### Update Settings
```http
PUT /api/offline/settings
Content-Type: application/json

{
  "maxStorageGB": 20,
  "autoCleanupEnabled": true,
  "cleanupStrategy": "largest",
  "cleanupThresholdPercent": 85
}
```

#### Manual Cleanup
```http
POST /api/offline/cleanup
Content-Type: application/json

{
  "targetFreeGB": 1
}
```

**Response:**
```json
{
  "success": true,
  "freedBytes": 1073741824,
  "itemsRemoved": 5,
  "errors": []
}
```

### Scheduler Settings

#### Get Scheduler Settings
```http
GET /api/offline/scheduler
```

**Response:**
```json
{
  "enabled": false,
  "allowedStartHour": 0,
  "allowedEndHour": 23,
  "maxBandwidthMBps": 0,
  "pauseDuringActiveUse": false
}
```

#### Update Scheduler Settings
```http
PUT /api/offline/scheduler
Content-Type: application/json

{
  "enabled": true,
  "allowedStartHour": 22,
  "allowedEndHour": 6,
  "maxBandwidthMBps": 5,
  "pauseDuringActiveUse": true
}
```

## Technical Implementation

### Dependencies

#### Frontend
- `@mantine/core` - UI components
- `@mantine/hooks` - React hooks utilities
- `@mantine/notifications` - Toast notifications
- `lucide-react` - Icons

#### Backend
- `archiver` - ZIP file creation
- `extract-zip` - ZIP file extraction
- `multer` - File upload handling
- `@types/multer` - TypeScript types

### State Management

- **Local State:** React `useState` for component-specific state
- **Derived State:** React `useMemo` for computed values
- **Side Effects:** React `useEffect` for data fetching
- **Callbacks:** React `useCallback` for stable function references
- **Real-time Updates:** Server-Sent Events (SSE) for live data

### Performance Optimizations

1. **Debouncing:** Search inputs debounced to 300ms
2. **Memoization:** Expensive computations memoized with `useMemo`
3. **Callback Stability:** Event handlers wrapped in `useCallback`
4. **Lazy Loading:** Components loaded on-demand
5. **Skeleton States:** Immediate visual feedback while loading
6. **Optimistic Updates:** UI updates before server confirmation

### Error Handling

All operations include comprehensive error handling:

1. **Try-Catch Blocks:** Wrap all async operations
2. **User Notifications:** Toast messages for success/failure
3. **Error Logging:** Structured logging with context
4. **Graceful Degradation:** Fallbacks for missing data
5. **Validation:** Input validation on both client and server

### File Storage Structure

```
.jamra-data/
├── .archives/                        # Temporary archive files
│   └── manga-title-timestamp.zip
├── .settings/                        # Configuration files
│   ├── storage.json                  # Storage settings
│   └── scheduler.json                # Scheduler settings
├── .uploads/                         # Temporary upload directory
└── [extensionId]/                    # Per-extension storage
    └── [mangaId]/                    # Per-manga directory
        ├── metadata.json             # Manga metadata
        ├── cover.jpg                 # Cover image
        └── chapters/
            └── [chapterId]/          # Per-chapter directory
                ├── metadata.json     # Chapter metadata
                └── pages/
                    ├── 001.jpg
                    ├── 002.jpg
                    └── ...
```

## Known Limitations

### 1. Bulk Archive (Minor)

**Status:** Partially Implemented
**Impact:** Low

**Description:**
The archive API currently rejects requests to archive multiple manga simultaneously. Users must archive manga one at a time.

**Location:** `packages/catalog-server/src/server.ts:2678-2686`

**Workaround:**
Archive manga individually. Each manga archives quickly and the process can be repeated.

**Future Fix:**
Replace single manga archiving logic with call to `archiveBulk()` function. Estimated effort: 30 minutes.

```typescript
// Current (line 2680)
if (items.length > 1) {
  res.status(400).json({
    error: "Bulk archiving not yet implemented",
    success: false,
  });
  return;
}

// Future fix: Use archiveBulk() instead
const result = await archiveBulk(dataRoot, items, outputPath, options);
```

### 2. Pause/Resume Downloads (Intentionally Skipped)

**Status:** Not Implemented
**Impact:** Low

**Description:**
Backend has `pauseDownloads()` and `resumeDownloads()` methods in `manager.ts:339,346` but they are not exposed via IPC to the download worker process.

**Workaround:**
Users can cancel downloads and retry them later. Download progress is not lost as completed pages are cached.

**Future Implementation:**
Add IPC message handlers in `downloader.ts` to expose pause/resume functionality. Estimated effort: 2 hours.

### 3. Priority Management (Intentionally Skipped)

**Status:** Not Implemented
**Impact:** Low

**Description:**
Backend has a `priority` field in `QueuedDownload` type but no methods to update download priority.

**Workaround:**
Downloads are processed in FIFO (first-in-first-out) order, which works well for most use cases.

**Future Implementation:**
Add priority update methods and UI controls to reorder queue. Estimated effort: 3 hours.

### 4. Scheduler Enforcement (Not Implemented)

**Status:** Settings UI Complete, Enforcement Not Implemented
**Impact:** Low

**Description:**
The scheduler settings panel allows configuration of download time windows and bandwidth limits, but these settings are not currently enforced by the download worker.

**Workaround:**
None needed - feature is optional enhancement.

**Future Implementation:**
Add scheduler checking logic to download worker before starting downloads. Estimated effort: 4 hours.

## Future Enhancements

### High Priority

None - all core features complete.

### Medium Priority

1. **Bulk Archive Support**
   - Enable archiving multiple manga into single ZIP or separate ZIPs
   - Add option to choose archive mode (single/separate)
   - Estimated effort: 1 hour

2. **Scheduler Enforcement**
   - Implement time window checking in download worker
   - Add bandwidth throttling support
   - Estimated effort: 4 hours

### Low Priority

1. **Pause/Resume Downloads**
   - Add IPC handlers for pause/resume
   - Add UI controls in Active Downloads tab
   - Estimated effort: 2 hours

2. **Priority Management**
   - Add drag-and-drop reordering
   - Add priority field to download items
   - Estimated effort: 3 hours

3. **Advanced Filters**
   - Filter by genre/tags
   - Filter by reading status
   - Custom filter presets
   - Estimated effort: 4 hours

4. **Statistics Dashboard**
   - Download speed graphs
   - Storage usage trends
   - Most downloaded series
   - Estimated effort: 6 hours

5. **Smart Cleanup**
   - Machine learning based cleanup suggestions
   - Reading pattern analysis
   - Automatic recommendations
   - Estimated effort: 8 hours

## Troubleshooting

### Issue: Downloads not starting

**Possible Causes:**
1. Download worker not initialized
2. Network connectivity issues
3. Extension not loaded

**Solutions:**
1. Check server logs for worker initialization
2. Verify network connection
3. Restart application
4. Check extension status in Extensions page

### Issue: Import fails with validation error

**Possible Causes:**
1. Archive corrupted
2. Invalid archive structure
3. Missing metadata files

**Solutions:**
1. Re-download archive file
2. Verify archive was created by Jamra export
3. Check archive contents manually
4. Try different conflict resolution option

### Issue: Storage cleanup not working

**Possible Causes:**
1. No manga meets cleanup criteria
2. Storage not actually at threshold
3. Permissions error

**Solutions:**
1. Check storage usage percentage
2. Verify cleanup threshold setting
3. Try manual cleanup button
4. Check file permissions on .jamra-data directory

### Issue: Metadata changes not saving

**Possible Causes:**
1. Invalid field values
2. Network error
3. File permissions

**Solutions:**
1. Verify all fields have valid values
2. Check network connection
3. Check server logs for errors
4. Verify write permissions

## Support

For issues, feature requests, or questions:

1. Check this documentation first
2. Review server logs: Check terminal output
3. Check browser console: Open DevTools (F12)
4. Report issues: GitHub Issues (if applicable)

## Changelog

### Version 1.0.0 (2025-10-24)

**Initial Release**

- ✅ Active Downloads tab with real-time tracking
- ✅ History tab with search and filters
- ✅ Manager tab with offline library
- ✅ Storage dashboard with statistics
- ✅ Search and filter system
- ✅ Bulk operations (select, delete, archive)
- ✅ Archive/Export to ZIP
- ✅ Import from ZIP
- ✅ Metadata editor
- ✅ Storage settings with auto-cleanup
- ✅ Download scheduler settings
- ✅ 13 new components (~4,000+ lines)
- ✅ 10 new API endpoints
- ✅ Full TypeScript support
- ✅ Comprehensive error handling
- ✅ Loading and empty states

**Known Issues:**
- Bulk archive limited to single manga
- Scheduler enforcement not implemented
- Pause/resume not exposed via UI

---

**Documentation Version:** 1.0.0
**Application Version:** Compatible with Jamra 0.1.0+
**Last Updated:** 2025-10-24
