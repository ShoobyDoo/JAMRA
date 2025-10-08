import type { ChapterSummary } from "./api";
import { slugify } from "./slug";

export interface ChapterWithSlug extends ChapterSummary {
  slug: string;
}

function buildBaseChapterSlug(chapter: ChapterSummary): string {
  const rawNumber = chapter.number?.trim();
  if (rawNumber && /^[0-9]+(?:\.[0-9]+)?$/.test(rawNumber)) {
    return rawNumber.replace(/^0+(\d)/, "$1");
  }

  const numberSlug = slugify(chapter.number);
  if (numberSlug) {
    return numberSlug;
  }

  const titleSlug = slugify(chapter.title);
  if (titleSlug) {
    return titleSlug.startsWith("chapter-") ? titleSlug : `chapter-${titleSlug}`;
  }

  const volumeSlug = slugify(chapter.volume);
  if (volumeSlug) {
    return `chapter-${volumeSlug}`;
  }

  const idFallback = chapter.id?.toLowerCase() ?? "";
  return `chapter-${idFallback.slice(0, 8) || "unknown"}`;
}

export function withChapterSlugs(chapters: ChapterSummary[]): ChapterWithSlug[] {
  const counts = new Map<string, number>();

  return chapters.map((chapter) => {
    const baseSlug = buildBaseChapterSlug(chapter);
    const existingCount = counts.get(baseSlug) ?? 0;

    counts.set(baseSlug, existingCount + 1);

    const slug = existingCount === 0 ? baseSlug : `${baseSlug}-${existingCount + 1}`;

    return {
      ...chapter,
      slug,
    };
  });
}

export function findChapterBySlug(
  chapters: ChapterWithSlug[],
  slug: string,
): ChapterWithSlug | undefined {
  return chapters.find((chapter) => chapter.slug === slug);
}

export function getChapterSlugById(
  chapters: ChapterWithSlug[],
  chapterId: string,
): string | undefined {
  return chapters.find((chapter) => chapter.id === chapterId)?.slug;
}

export function formatChapterSlugForDisplay(slug: string): string {
  const decoded = decodeURIComponent(slug ?? "");
  if (!decoded) {
    return "Chapter";
  }

  if (decoded.startsWith("chapter-")) {
    const remainder = decoded.slice("chapter-".length).replace(/-/g, " ").trim();
    return remainder.length > 0 ? `Chapter ${remainder}` : "Chapter";
  }

  const cleaned = decoded.replace(/-/g, " ").trim();
  return cleaned.length > 0 ? `Chapter ${cleaned}` : "Chapter";
}
