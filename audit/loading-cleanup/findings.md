# Loading & Navigation Audit Findings

## Summary

During the UI loading/a11y audit we identified several improvements beyond the immediate fixes shipped in this batch. The following items are candidates for follow-up work:

1. **Search Result Fetch Concurrency** – `fetchCataloguePage` calls in `src/app/(app)/search/page.tsx` do not cancel prior requests. Rapid query changes can race, momentarily showing stale results. Adding an `AbortController` per in-flight request (cleared on effect cleanup) would eliminate the edge-case.

2. **Reading Progress Prefetch** – The home page and chapter list call `getAllReadingProgress` independently. Consolidating progress hydration server-side (or via a dedicated endpoint) would reduce duplicate client calls and shorten the first paint for progress indicators.

3. **Reader Chunk Persistence** – Chunk caching currently lives in-memory per session. Persisting chunk metadata in IndexedDB (or rehydrating from the extension host when revisiting) would make back/forward navigation instant even after a hard refresh.

4. **Skeleton Consistency** – All static headings now render immediately, but there are still components (e.g., filter buttons on the search page) that flip between skeleton and live UI. Introducing a shared “card skeleton” pattern for lists would keep loading visuals consistent and easier to update.

5. **Route-Level Suspense Boundaries** – Several routes (home, discover, read) are marked `force-dynamic`, forcing full SSR on each request. Evaluating whether sections of those pages can opt into `revalidate` or partial caching would improve TTFB without sacrificing freshness.

Each of these items can be tracked as separate follow-up tasks once prioritised.
