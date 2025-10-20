import type { ChapterWithSlug } from "./chapter-slug";

function parseNumberFromString(value?: string | null): number | null {
  if (!value) return null;
  const numeric = Number.parseFloat(value);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isNaN(parsed) ? null : parsed;
}

function toTimestamp(value?: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function getChapterSortValue(chapter: ChapterWithSlug): number | null {
  return (
    parseNumberFromString(chapter.number) ??
    parseNumberFromString(chapter.title) ??
    toTimestamp(chapter.publishedAt)
  );
}

export function compareChaptersDesc(
  a: ChapterWithSlug,
  b: ChapterWithSlug,
): number {
  const aValue = getChapterSortValue(a);
  const bValue = getChapterSortValue(b);

  if (aValue !== null || bValue !== null) {
    return (
      (bValue ?? Number.NEGATIVE_INFINITY) -
      (aValue ?? Number.NEGATIVE_INFINITY)
    );
  }

  return b.slug.localeCompare(a.slug);
}

export function compareChaptersAsc(
  a: ChapterWithSlug,
  b: ChapterWithSlug,
): number {
  return compareChaptersDesc(b, a);
}

export function sortChaptersDesc(
  chapters: ChapterWithSlug[],
): ChapterWithSlug[] {
  return [...chapters].sort(compareChaptersDesc);
}

export function sortChaptersAsc(
  chapters: ChapterWithSlug[],
): ChapterWithSlug[] {
  return [...chapters].sort(compareChaptersAsc);
}

export function formatChapterTitle(chapter: ChapterWithSlug): string {
  if (chapter.title && chapter.title.trim().length > 0) {
    return chapter.title;
  }
  if (chapter.number && chapter.number.trim().length > 0) {
    return `Chapter ${chapter.number}`;
  }
  return `Chapter ${chapter.slug}`;
}
