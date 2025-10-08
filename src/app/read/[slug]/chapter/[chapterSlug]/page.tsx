import { notFound, redirect } from "next/navigation";
import { fetchChapterPages, fetchChapterPagesChunk, fetchMangaDetails } from "@/lib/api";
import { MangaReader } from "@/components/reader/manga-reader";
import { findChapterBySlug, withChapterSlugs } from "@/lib/chapter-slug";
import {
  decodeRouteParam,
  getSearchParam,
  type ReaderRouteParams,
  type RouteSearchParams,
} from "@/lib/routes";
import { logger } from "@/lib/logger";

const INITIAL_CHUNK_SIZE = 10;

interface ReaderPageProps {
  params: Promise<ReaderRouteParams>;
  searchParams?: Promise<RouteSearchParams>;
}

export default async function ReaderPage({ params, searchParams }: ReaderPageProps) {
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
    redirect(`/read/${encodeURIComponent(canonicalSlug)}/chapter/${encodeURIComponent(targetChapter.slug)}`);
  }

  const chapterId = targetChapter.id;

  const rawRequestedPage = (() => {
    if (pageParam === "last") return -1;
    if (typeof pageParam === "string") {
      const parsed = Number.parseInt(pageParam, 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  })();

  let initialChunkIndex =
    typeof rawRequestedPage === "number" && rawRequestedPage >= 0
      ? Math.floor(rawRequestedPage / INITIAL_CHUNK_SIZE)
      : 0;

  let initialPages = [];
  let totalPages = 0;
  let chunkSize = INITIAL_CHUNK_SIZE;
  let totalChunks = 1;

  try {
    const chunk = await fetchChapterPagesChunk(
      mangaId,
      chapterId,
      initialChunkIndex,
      INITIAL_CHUNK_SIZE,
      mangaData.extensionId,
    );
    initialPages = chunk.pages;
    totalPages = chunk.totalPages;
    chunkSize = chunk.chunkSize;
    totalChunks = chunk.totalChunks;
  } catch (chunkError) {
    logger.warn("Chunked chapter fetch failed, falling back to full fetch", {
      component: "reader-page",
      action: "fetch-chunk",
      mangaId,
      chapterId,
      error: chunkError instanceof Error ? chunkError : new Error(String(chunkError)),
    });
    try {
      const pagesData = await fetchChapterPages(mangaId, chapterId, mangaData.extensionId);
      initialPages = pagesData.pages.pages;
      totalPages = initialPages.length;
      chunkSize = initialPages.length;
      totalChunks = 1;
    } catch (error) {
      logger.error("Failed to fetch chapter pages", {
        component: "reader-page",
        action: "fetch-pages",
        mangaId,
        chapterId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return notFound();
    }
  }

  let requestedPage = rawRequestedPage;
  if (requestedPage === -1) {
    requestedPage = totalPages > 0 ? totalPages - 1 : undefined;
  }
  let initialPage: number | undefined;
  if (typeof requestedPage === "number" && requestedPage >= 0) {
    initialPage = Math.min(requestedPage, Math.max(totalPages - 1, 0));
  }

  const computedInitialChunkIndex =
    initialPage !== undefined
      ? Math.floor(initialPage / Math.max(chunkSize, 1))
      : 0;

  if (computedInitialChunkIndex !== initialChunkIndex && chunkSize > 0) {
    try {
      const chunk = await fetchChapterPagesChunk(
        mangaId,
        chapterId,
        computedInitialChunkIndex,
        chunkSize,
        mangaData.extensionId,
      );
      initialPages = chunk.pages;
      totalPages = chunk.totalPages;
      chunkSize = chunk.chunkSize;
      totalChunks = chunk.totalChunks;
      initialChunkIndex = computedInitialChunkIndex;
    } catch {
      // If refetch fails, fall back to previously loaded chunk.
      initialChunkIndex = Math.max(initialChunkIndex, 0);
    }
  }

  const mangaTitle = mangaDetails.title;

  return (
    <MangaReader
      mangaId={mangaId}
      mangaSlug={canonicalSlug}
      mangaTitle={mangaTitle}
      chapterId={chapterId}
      chapterSlug={targetChapter.slug}
      initialPages={initialPages}
      totalPages={totalPages}
      initialChunkSize={chunkSize}
      initialChunkIndex={initialChunkIndex}
      totalChunks={totalChunks}
      extensionId={mangaData.extensionId}
      chapters={chapters}
      initialPage={initialPage}
    />
  );
}
