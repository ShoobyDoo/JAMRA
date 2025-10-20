# Reader Scrubbing Regressions

## Context

Recent regressions introduced non-blocking chunk loading in the reader but surfaced multiple issues:

1. **Scrub Jumps & Page Gaps** – When dragging the page slider, the reader often lands on multiples of the chunk size (e.g., page 90, 100, 110) and displays "No page data". Jumping cancels multiple chunk fetches without guaranteeing the destination chunk finishes.

2. **Excessive Abort Logging** – Aborted `fetchChapterPagesChunk` requests log as errors, triggering noisy Next.js overlays and masking real failures.

3. **Missing Chapter Cache** – Previously loaded chunks are lost on abort or navigation; scrubbing back re-fetches and may stall if the extension throttles.

4. **Loading Indicator Stalls** – The bottom spinner can persist even after the target chunk finishes (or fails), leaving no feedback/retry path.

## Objectives

- Guarantee the target page becomes available after a scrub jump, even when rapid drag cancels prior requests.
- Cache fetched chunks per chapter in-session to avoid redundant requests and allow instant revisit.
- Differentiate aborted requests from true network errors in logging.
- Provide deterministic loading state (and retries) when a chunk fails.
- Prevent "No page data" flicker once a page index is selected.

## Plan

1. **Chunk State Store**
   - Introduce a `useChapterChunkStore` (React `useRef` + helper functions) keyed by `chunkIndex` storing `{ status: "idle" | "pending" | "loaded" | "error"; pages?: PageImage[]; controller?: AbortController }`.
   - Expose helpers: `getChunk(index)`, `setChunkPending(index, controller)`, `setChunkLoaded(index, pages)`, `setChunkError(index, error)`, `abortAllExcept(indexes: number[])`, `clearChunksOnChapterChange()`.
   - `pages` state derives from concatenating cached chunk pages sorted by index; removal of duplicates handled centrally.

2. **Targeted Fetch Workflow**
   - `ensurePageAvailable(pageIndex, opts)`:
     - Compute `targetChunk`.
     - If chunk already `loaded`, return.
     - If `pending`, await its promise.
     - Otherwise, kick off `fetchChunk(targetChunk)`:
       - Abort all other pending chunks (except optional neighbors).
       - Create new `AbortController`, mark chunk `pending`, store promise in chunk store.
       - On success → `setChunkLoaded`, append pages, mark `hasMore` from response.
       - On `AbortError` → set chunk back to `idle`, swallow log (debug message only).
       - On real error → `setChunkError`, surface UI toast/indicator; provide `retryChunk(index)` callback.
   - After chunk resolves, optionally prefetch `targetChunk ± 1` (only if not loaded/pending) without canceling the target.

3. **Reader Progress & Initial Restore**
   - Wrap reader render in a `isPageReady` guard:
     - When `useReaderProgress` sets `currentPage`, call `ensurePageAvailable(currentPage, { keepPending: true })`.
     - Block render with a lightweight skeleton (e.g., Mantine `<Loader />`) until the promise resolves or errors.
   - If chunk errors, show inline error with “Retry” button that invokes `retryChunk(chunkIndex)`; fallback to `No page data` only after repeated failure.

4. **Logging & Error Handling**
   - Update `fetchChapterPagesChunk` to accept optional `onAbort` callback.
   - In the reader, differentiate error types:
     - `AbortError` → log via `logger.debug` with reason “chunk-fetch-aborted”.
     - Other errors → `logger.error` with chunk metadata; mark chunk `error`.
   - Update `request` helper to skip logging when `error.name === "AbortError"` and `init.signal?.aborted` is true.

5. **Caching Strategy**
   - Cache chunk responses in `useRef<Map<number, PageImage[]>>` per chapter; after `setChunkLoaded` merges pages, store them in the cache map.
   - On chapter change, reset all chunk maps.
   - When revisiting a chunk, reuse cached pages instantly, skip re-fetch unless `forceRefresh` flag is set (future extension support).

6. **UI State Enhancements**
   - Reader controls bottom bar: show spinner only when the _target chunk_ is `pending`.
   - When chunk `error`, show inline message (e.g., `Failed to load page. Retry`) with button calling `retryChunk(currentChunk)`.
   - Ensure `onPrevPage`/`onNextPage` guard against navigating to indexes whose chunks are `error` (auto-trigger retry).

7. **Home Continue-Reading Integration**
   - After caching improvements, confirm `ContinueReadingCard` uses accurate chapter progress (already fixed). Ensure link triggers `router.push` before page is ready; while awaiting chunk, show reader skeleton rather than stale `No page data`.

8. **Testing / Validation**
   - Manual: rapid scrubbing across 50+ pages to confirm page availability without jumps.
   - Automated: add unit test for chunk store helper (if feasible) to verify state transitions.
   - Confirm logs show `debug` for aborted fetches, `error` only on genuine failures.
