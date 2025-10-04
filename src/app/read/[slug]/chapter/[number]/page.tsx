import { notFound } from "next/navigation";
import { fetchChapterPages, fetchMangaDetails } from "@/lib/api";
import { MangaReader } from "@/components/reader/manga-reader";

interface ReaderPageProps {
  params: Promise<{ slug: string; number: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function ReaderPage({ params, searchParams }: ReaderPageProps) {
  const { slug: rawSlug, number: rawNumber } = await params;
  const { page: pageParam } = await searchParams;
  const mangaId = decodeURIComponent(rawSlug ?? "");
  const chapterId = decodeURIComponent(rawNumber ?? "");

  if (!mangaId || !chapterId) return notFound();

  let pagesData;
  let mangaData;

  try {
    [pagesData, mangaData] = await Promise.all([
      fetchChapterPages(mangaId, chapterId),
      fetchMangaDetails(mangaId),
    ]);
  } catch (error) {
    console.error("Failed to fetch chapter data", error);
    return notFound();
  }

  const pages = pagesData.pages.pages;
  const chapters = mangaData.details.chapters ?? [];
  const mangaTitle = mangaData.details.title;

  // Determine initial page based on query parameter
  const initialPage = pageParam === "last" ? pages.length - 1 : undefined;

  return (
    <MangaReader
      mangaId={mangaId}
      mangaTitle={mangaTitle}
      chapterId={chapterId}
      chapterTitle={`Chapter ${chapterId}`}
      pages={pages}
      chapters={chapters}
      initialPage={initialPage}
    />
  );
}
