import { notFound, redirect } from "next/navigation";
import { fetchMangaDetails } from "@/lib/api";
import { MangaReader } from "@/components/reader/manga-reader";
import { findChapterBySlug, withChapterSlugs } from "@/lib/chapter-slug";
import {
  decodeRouteParam,
  getSearchParam,
  type ReaderRouteParams,
  type RouteSearchParams,
} from "@/lib/routes";
import { logger } from "@/lib/logger";

interface ReaderPageProps {
  params: Promise<ReaderRouteParams>;
  searchParams?: Promise<RouteSearchParams>;
}

export default async function ReaderPage({
  params,
  searchParams,
}: ReaderPageProps) {
  const { slug: rawSlug, chapterSlug: rawChapterSlug } = await params;
  const requestedSlug = decodeRouteParam(rawSlug);
  const chapterSlug = decodeRouteParam(rawChapterSlug);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const pageParam = getSearchParam(resolvedSearchParams, "page");

  if (!requestedSlug || !chapterSlug) return notFound();

  let mangaData;
  try {
    mangaData = await fetchMangaDetails(requestedSlug);
  } catch (error) {
    logger.error("Failed to fetch manga details", {
      component: "reader-page",
      action: "fetch-manga",
      error: error instanceof Error ? error : new Error(String(error)),
      slug: requestedSlug,
    });
    return notFound();
  }

  const mangaDetails = mangaData.details;
  if (!mangaDetails?.id) return notFound();

  const mangaId = mangaDetails.id;
  const canonicalSlug = mangaDetails.slug ?? requestedSlug;
  const chapters = withChapterSlugs(mangaDetails.chapters ?? []);
  const targetChapter =
    findChapterBySlug(chapters, chapterSlug) ??
    chapters.find((chapter) => chapter.id === chapterSlug);

  if (!targetChapter) {
    return notFound();
  }

  if (targetChapter.slug !== chapterSlug) {
    redirect(
      `/read/${encodeURIComponent(canonicalSlug)}/chapter/${encodeURIComponent(targetChapter.slug)}`,
    );
  }

  const chapterId = targetChapter.id;

  // Parse initial page if provided
  const rawRequestedPage = (() => {
    if (pageParam === "last") return -1;
    if (typeof pageParam === "string") {
      const parsed = Number.parseInt(pageParam, 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  })();

  // The sequential loader will handle all page loading client-side
  // We only need to pass the initial page number if specified
  let initialPage: number | undefined;
  if (rawRequestedPage === -1) {
    // "last" page will be determined client-side once we know total pages
    initialPage = undefined;
  } else if (typeof rawRequestedPage === "number" && rawRequestedPage >= 0) {
    initialPage = rawRequestedPage;
  }

  const mangaTitle = mangaDetails.title;

  return (
    <MangaReader
      mangaId={mangaId}
      mangaSlug={canonicalSlug}
      mangaTitle={mangaTitle}
      chapterId={chapterId}
      chapterSlug={targetChapter.slug}
      extensionId={mangaData.extensionId}
      chapters={chapters}
      initialPage={initialPage}
    />
  );
}
