# Manga Reader Overview

Authoritative reference for the current reader implementation, covering supported behaviours and outstanding work that is still on the roadmap.

---

## Capabilities

### Reading Modes

The reader ships four modes backed by a shared viewport (`src/components/reader/reader-viewport.tsx`):

- **Paged LTR / RTL** — single page navigation with directional hot zones (`reading-modes/paged-mode.tsx`).
- **Dual Page** — side-by-side spreads with previous/next chapter affordances (`reading-modes/dual-page-mode.tsx`).
- **Vertical Scroll** — stacked layout for manhwa/webtoon style content (`reading-modes/vertical-mode.tsx`).
- Mode selection, page fit, background colour, and preload settings live in the reader settings panel (`reader-settings-panel.tsx`) and persist via `useReaderSettings`.

### Navigation & Input

- **Keyboard** — handled by `useReaderNavigation`:
  - Arrows: page forward/back (vertical mode respects native scroll for Up/Down).
  - Space/Shift+Space: next/previous page.
  - Home/End: jump to first/last page.
  - `m`: cycle modes, `f`: toggle zen/fullscreen, `s`: open settings, `Esc`: exit.
- **Pointer** — click hot zones to page, drag in paged modes for page turn animation.
- **Touch** — `useTouchGestures` supports swipe left/right, double tap (toggle width/height), and long press (open settings).
- **Auto advance** — when `autoAdvanceChapter` is enabled (default), invoking “next page” at the end of a chapter immediately routes to the next chapter if one exists.

### State & Persistence

- `useSequentialPageLoader` fetches the entire chapter payload via `getChapterPages` once, then progressively hydrates the in-memory array to keep the UI responsive. Image preload can be toggled via settings.
- Reading progress is managed by `useReadingProgress`, persisting both locally and through the `/api/reading-progress` endpoints. Chapter completion timestamps feed the “Continue Reading” home section.
- History entries (read/favorite/library actions) are logged lazily through the API client.

### Observability

- `usePerformanceMonitor` can be dropped into performance-sensitive components to log mount/unmount timings via `src/lib/logger`.

---

## Known Limitations & Backlog

- **Chunk streaming** — backend support for `/pages/chunk/:chunk` exists, but the UI still issues a single `/pages` request per chapter. Moving `useSequentialPageLoader` to `fetchChapterPagesChunk` is tracked separately.
- **Virtualisation** — vertical mode currently renders every page element, which can impact long chapters. A virtualised window (e.g. `@tanstack/react-virtual`) is still on the roadmap.
- **Previous chapter affordances** — the dual-page mode exposes a direct “previous chapter” button; other modes rely on standard navigation controls.
- **Offline caching** — there is no automatic rebuild of the in-memory page list after a hard refresh; pairing with offline-storage remains future work.
- **Accessibility** — screen-reader semantics and high-contrast modes are pending.

---

## Key Files

- `src/components/reader/manga-reader.tsx` — top-level orchestrator tying settings, loader, and controls together.
- `src/components/reader/hooks/use-sequential-page-loader.ts` — sequential loader implementation.
- `src/components/reader/hooks/use-reader-progress.ts` — syncs API progress with local state.
- `src/components/reader/reader-controls.tsx` — top/bottom chrome with chapter selectors, sliders, and zen toggles.
- `src/store/reader-settings.ts` — persisted user preferences.

Keep this document aligned with the implementation; update it whenever reader behaviour changes.
