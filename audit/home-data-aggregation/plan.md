# Home Data Aggregation

## Context

The home page now caches individual `fetchMangaDetails` calls and limits history enrichment to 12 entries, but it still issues up to 12 API requests (plus chapter lookups inside each response). A backend aggregation endpoint would reduce latency spikes and isolate home rendering from per-manga fetch variance.

## Objectives

- Provide a single API call that returns reading history entries enriched with manga & chapter metadata.
- Allow the client to render the entire home view with one network trip.
- Preserve existing fallback/error handling and continue to support manual refresh clearing.

## Plan

1. Extend the catalog service/server with a `/reading-progress/enriched` endpoint that:
   - Accepts a limit parameter.
   - Fan-out fetches details/chapters server-side (respecting caches).
   - Returns normalized DTOs consumed by the UI.
2. Update the web app to call the new endpoint from the home page and simplify local caching logic.
3. Remove redundant client-side caching once the aggregated response is in place while keeping memoisation for safety.
4. Document the new endpoint and update any CLI/desktop integrations that need enriched progress data.
