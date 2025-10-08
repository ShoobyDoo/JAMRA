# Chapter Ordering & Metadata

## Context

Chapter-centric components (`ChapterList`, `ContinueReadingButton`, `ContinueReadingCard`) rely on `Array.prototype.sort()` without a comparator, producing unstable ordering (effectively no-op when sorting objects). Numeric comparisons fall back to manual parsing sprinkled across components, and label generation repeats formatting logic. This leads to inconsistent ordering, difficult-to-read code, and makes chapter navigation brittle.

## Objectives

- Guarantee deterministic ordering descending by chapter number (with sensible fallbacks).
- Centralize chapter metadata helpers (formatting, numeric extraction) to avoid duplication.
- Update all chapter-facing components to consume the shared helpers while preserving type safety.

## Plan

1. Add a `src/lib/chapter-meta.ts` module exposing helpers:
   - `getChapterSortValue(chapter: ChapterWithSlug): number`
   - `formatChapterTitle(chapter: ChapterWithSlug): string`
   - `sortChaptersDesc(chapters: ChapterWithSlug[]): ChapterWithSlug[]`
2. Refactor `ChapterList`, `ContinueReadingButton`, and `ContinueReadingCard` to use the shared helpers instead of inline parsing/sorting.
3. Ensure slug enrichment (`withChapterSlugs`) happens once per data load and is reused.
4. Re-run `pnpm lint` to validate the refactor.
