import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  formatChapterTitle,
  getChapterSortValue,
  sortChaptersDesc,
} from "@/lib/chapter-meta";
import type { ChapterWithSlug } from "@/lib/chapter-slug";

function buildChapter(overrides: Partial<ChapterWithSlug> = {}): ChapterWithSlug {
  return {
    id: overrides.id ?? randomUUID(),
    slug: overrides.slug ?? "1",
    title: overrides.title,
    number: overrides.number,
    volume: overrides.volume,
    publishedAt: overrides.publishedAt,
    scanlators: overrides.scanlators,
  };
}

export function runChapterMetaTests(): void {
  const explicitTitle = buildChapter({
    title: "Special Chapter",
    slug: "special-chapter",
  });
  assert.equal(formatChapterTitle(explicitTitle), "Special Chapter");
  assert.equal(getChapterSortValue(explicitTitle), null);

  const numberedChapter = buildChapter({ number: "12.5", slug: "12.5" });
  assert.equal(formatChapterTitle(numberedChapter), "Chapter 12.5");

  const fallbackChapter = buildChapter({ slug: "chapter-extra" });
  assert.equal(formatChapterTitle(fallbackChapter), "Chapter chapter-extra");

  assert.equal(getChapterSortValue(numberedChapter), 12.5);

  const titleOnlyChapter = buildChapter({
    title: "Episode 7",
    number: undefined,
    slug: "chapter-episode-7",
  });
  assert.equal(getChapterSortValue(titleOnlyChapter), 7);

  const datedChapter = buildChapter({
    id: "d",
    slug: "chapter-4",
    publishedAt: "2024-01-01T00:00:00.000Z",
    number: undefined,
    title: undefined,
  });
  assert.equal(getChapterSortValue(datedChapter), Date.parse(datedChapter.publishedAt!));

  const sortSource: ChapterWithSlug[] = [
    buildChapter({ id: "a", slug: "1", number: "1" }),
    buildChapter({ id: "b", slug: "2", number: "2" }),
    buildChapter({ id: "c", slug: "chapter-3", title: "Chapter 3" }),
    datedChapter,
  ];

  const sorted = sortChaptersDesc(sortSource);
  assert.deepEqual(
    sorted.map((chapter) => chapter.id),
    ["d", "c", "b", "a"],
  );
}
