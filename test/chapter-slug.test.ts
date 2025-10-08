import assert from "node:assert/strict";
import { withChapterSlugs } from "@/lib/chapter-slug";
import type { ChapterSummary } from "@/lib/api";

export function runChapterSlugTests(): void {
  const input: ChapterSummary[] = [
    {
      id: "a",
      number: "1",
    },
    {
      id: "b",
      number: "1",
    },
    {
      id: "c",
      title: "Bonus Story",
    },
    {
      id: "d",
      number: "12.5",
    },
  ];

  const withSlugs = withChapterSlugs(input);

  const chapter1 = withSlugs.find((chapter) => chapter.id === "a");
  const chapter1Duplicate = withSlugs.find((chapter) => chapter.id === "b");
  const bonus = withSlugs.find((chapter) => chapter.id === "c");
  const decimal = withSlugs.find((chapter) => chapter.id === "d");

  assert(chapter1);
  assert.equal(chapter1.slug, "1");

  assert(chapter1Duplicate);
  assert.equal(chapter1Duplicate.slug, "1-2");

  assert(bonus);
  assert.ok(bonus.slug.startsWith("chapter-"));

  assert(decimal);
  assert.equal(decimal.slug, "12.5");
}
