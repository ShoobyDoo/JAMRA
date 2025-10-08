# Type-Safe Routing & Params

## Context

Next.js server components in `src/app/(app)/manga/[slug]/page.tsx` and `src/app/read/[slug]/chapter/[chapterSlug]/page.tsx` currently declare `params` and `searchParams` as `Promise<...>`. Next provides plain objects, so `await`-ing them is misleading, complicates type inference, and encourages spread of the pattern elsewhere. We also repeatedly re-encode route segments inline.

## Objectives

- Ensure route params/search params use accurate types so TypeScript catches missing keys early.
- Provide a lightweight helper for consistent slug extraction + decoding.
- Remove unnecessary `await` usage from server components to simplify control flow.

## Plan

1. Introduce a `RouteParams` helper in `src/lib/routes.ts` (or similar) that defines the expected param shapes and exposes a `decodeRouteParam` utility.
2. Update `src/app/(app)/manga/[slug]/page.tsx` and `src/app/read/[slug]/chapter/[chapterSlug]/page.tsx` to consume the helper, switching `params`/`searchParams` definitions to plain objects.
3. Replace ad-hoc `decodeURIComponent` calls with the helper while keeping explicit `notFound()` guards.
4. Run `pnpm lint` to confirm type accuracy and ensure no regressions.
