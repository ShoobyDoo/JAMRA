# Library & History Features

Last reviewed: February 2025

This guide describes the shipped behaviour for the Library, History, and
Reading Progress surfaces, covering persistence, API contracts, and client usage.

---

## Overview

- **Library** lets users bookmark manga, track status
  (reading/completed/etc.), favourite titles, and organise entries with tags. It
  powers the Library page at `/library`.
- **History** records notable events (reads, favourites, library changes,
  downloads) to fuel the timeline at `/history` and related statistics.
- **Reading progress** syncs in-chapter state to the database so users can pick
  up where they left off across sessions and devices.

All three domains build on the catalog database (`packages/catalog-db`), are
exposed through REST endpoints in `packages/catalog-server`, and surface via
typed helpers in `src/lib/api/` with Zustand stores under `src/store`.

---

## Reading Progress

### Persistence

- `reading_progress` table (migration #6) stores `(manga_id, chapter_id)` as the
  composite key alongside `current_page`, `total_pages`, `scroll_position`
  (reserved for vertical mode), and `last_read_at` timestamps.
- Indexed on `last_read_at DESC` so the Continue Reading surface can fetch the
  most recent entries efficiently.

### API

- `POST /api/reading-progress` – idempotent upsert used on every page change.
- `GET /api/reading-progress/:mangaId/:chapterId` – fetch a single record.
- `GET /api/reading-progress` – list all records (used for migration tasks).
- `GET /api/reading-progress/enriched?limit=<n>` – latest entry per manga with
  hydrated metadata for UI cards.

Types live in `src/lib/api/reading-progress.ts`.

### Client usage

- `src/store/reading-progress.ts` keeps an in-memory cache backed by local
  storage; setters fire-and-forget API calls so rendering stays snappy.
- `useReaderProgress` initialises the store by loading API state, keeps local
  state in sync, and updates history entries when chapters are opened.
- Continue-reading UI pulls from the enriched endpoint and augments it with
  chapter metadata for quick navigation.

---

## Library & History persistence

| Table | Purpose | Key Columns |
| ----- | ------- | ----------- |
| `library_entries` | One row per manga in the library. | `manga_id` (PK), `extension_id`, `status`, `personal_rating`, `favorite`, `notes`, timestamps (`added_at`, `updated_at`, `started_at`, `completed_at`). |
| `library_tags` | User-defined tags. | `id`, `name`, `color`, `created_at`. |
| `library_entry_tags` | Join table between library entries and tags. | Composite PK `(manga_id, tag_id)`. |
| `history_entries` | Audit log of user actions. | `id`, `manga_id`, `chapter_id?`, `action_type`, `timestamp`, `extension_id?`, `metadata` (JSON). |

---

## API surface

### Library

| Endpoint | Description |
| -------- | ----------- |
| `POST /api/library` | Add a manga to the library. Body accepts `mangaId`, `extensionId`, `status`, plus optional `personalRating`, `favorite`, `notes`, `startedAt`, `completedAt`. |
| `PUT /api/library/:mangaId` | Update status, rating, favorite flag, or notes for an entry. |
| `DELETE /api/library/:mangaId` | Remove a manga from the library. |
| `GET /api/library/:mangaId` | Fetch a single entry. |
| `GET /api/library` | List entries (supports `status` and `favorite` query params). |
| `GET /api/library-enriched` | Returns entries joined with manga metadata and aggregated progress information. |
| `GET /api/library-stats` | Summary counts grouped by status and favourites. |
| `POST /api/library/tags` | Create a tag (`name`, optional `color`). |
| `DELETE /api/library/tags/:tagId` | Delete a tag. |
| `GET /api/library/:mangaId/tags` | List tags applied to an entry. |
| `POST /api/library/:mangaId/tags/:tagId` | Attach a tag to an entry. |
| `DELETE /api/library/:mangaId/tags/:tagId` | Remove a tag from an entry. |

### History

| Endpoint | Description |
| -------- | ----------- |
| `POST /api/history` | Append a history entry. Body includes `mangaId`, `actionType`, optional `chapterId`, `extensionId`, `metadata`. |
| `GET /api/history` | Paged list of history entries (`limit`, `offset`, `actionType`, `mangaId`, `startDate`, `endDate`, `enriched` query params). |
| `GET /api/history/stats` | Aggregate metrics (entries per action type, date ranges, etc.). |
| `DELETE /api/history/:id` | Remove a single entry. |
| `DELETE /api/history?before=<timestamp>` | Bulk delete entries before a timestamp (optional `actionType` filter). |

All endpoints return JSON DTOs defined in `src/lib/api/library.ts` and `src/lib/api/history.ts`.

---

## Frontend usage

### Library

- Zustand store: `src/store/library.ts`
  - Persists entries in a `Map`, exposes filters (status, favourites, tags, search), sorting, and selection helpers.
  - `loadLibrary()` hydrates data using the enriched endpoint, with additional metadata loaded via `loadStats()` and `loadTags()`.
  - Actions log activity to history via `logHistoryEntry` (e.g., adding to library, toggling favourites).
- UI:
  - Page: `src/app/(app)/(public)/library/page.tsx`
  - Components: `LibraryFilterBar`, `LibraryGrid`, `AddToLibraryButton`, tag management controls.
  - Offline integration: when chapters are downloaded through the offline-storage manager, entries can be highlighted via store filters.

### History

- Zustand store: `src/store/history.ts`
  - Tracks timeline entries, stats, filters, pagination, and view modes (timeline/list/grid).
  - Exposes helpers to log events (`logEntry`), clear history, and fetch additional pages.
- UI:
  - Page: `src/app/(app)/(public)/history/page.tsx`
  - Stats view: `src/app/(app)/(public)/history/stats/page.tsx`
  - Components consume the enriched API to display manga details alongside events.

### Automatic Logging

- `useReadingProgress` logs `"read"` actions when chapters are opened.
- `useLibrary` logs `"library_add"`, `"favorite"`, and `"unfavorite"` events.
- Additional domains (downloads, settings) can log via the shared API helper in `src/lib/api/history.ts`.

---

## Future improvements

- **Bulk operations** — backend currently lacks bulk add/remove endpoints; client workarounds loop across selected entries.
- **History filters** — expand UI to surface action-type chips and date pickers (API already supports the filters).
- **Offline sync** — align offline storage events with history entries for richer context.

Keep this document in sync with the API and store implementations whenever behaviour changes.
