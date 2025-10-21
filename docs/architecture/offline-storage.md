# Offline Storage Architecture

Last reviewed: February 2025.

Offline storage lets readers download manga chapters for disconnected use. The
system combines a SQLite queue with deterministic on-disk layouts to ensure data
is resumable, cacheable, and easy to clean up.

## Directory layout

```
.jamra-data/
└── offline/
    └── {extensionId}/
        └── {mangaSlug}/
            ├── metadata.json
            ├── cover.jpg
            └── chapters/
                └── chapter-0001/
                    ├── metadata.json
                    └── page-0001.jpg
```

- `metadata.json` (manga) stores identification details, cover metadata, and a
  catalogue of downloaded chapters.
- Chapter folders keep `metadata.json` with page descriptors plus the image
  payload (`page-0001.jpg`, etc.). Filenames are deterministic so progress can
  resume after crashes.

## Persistence model

- `offline_queue` – tracks pending chapter downloads, prioritised by
  user-initiated vs. auto-download tasks.
- `offline_chapters` – records downloaded chapters, byte size, and timestamps.
- `offline_manga` – mirrors the manga metadata stored alongside downloads.
- `offline_download_events` – lightweight audit trail for UI feedback and
  telemetry.

All tables are managed through `packages/offline-storage`, which exposes a
transactional API for enqueueing downloads, updating progress, and pruning
storage.

## Worker & queue

1. UI enqueues downloads through the offline storage manager. Items include
   extension/manga identifiers, desired chapter, and request metadata.
2. A single worker processes the queue with a configurable concurrency limit
   (default: 2 simultaneous chapter downloads). Each chapter is fetched page by
   page, writing metadata and images incrementally.
3. Failures trigger exponential backoff with a retry counter; exhausted retries
   flag the job for manual review.
4. Cleanup policies remove oldest unread chapters when storage thresholds are
   exceeded, keeping recently read items intact.

## Serving offline data

- The catalog service detects offline availability and serves files directly
  from disk via `/api/offline/*` routes.
- The reader loader consults offline metadata to avoid network requests when a
  chapter is cached.
- History and library screens receive download events so they can surface
  “Available offline” badges.

## Future work

- Virtualised reader rendering for large offline chapters.
- Smarter auto-download heuristics (prefetch next unread chapter).
- Export/import tooling for sharing cached chapters across devices.

## References

- Manager implementation: `packages/offline-storage/src/offlineStorageManager.ts`
- API routes: `packages/catalog-server/src/server.ts` (`/api/offline/*`)
- Reader hooks: `src/components/reader/hooks/use-offline-chapter.ts`
