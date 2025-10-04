import { notFound } from "next/navigation";
import { fetchChapterPages } from "@/lib/api";
import { MangaReader } from "@/components/reader/manga-reader";

interface ReaderPageProps {
  params: Promise<{ slug: string; number: string }>;
}

export default async function ReaderPage({ params }: ReaderPageProps) {
  const { slug: rawSlug, number: rawNumber } = await params;
  const mangaId = decodeURIComponent(rawSlug ?? "");
  const chapterId = decodeURIComponent(rawNumber ?? "");

  if (!mangaId || !chapterId) return notFound();

  let data;
  try {
    data = await fetchChapterPages(mangaId, chapterId);
  } catch (error) {
    console.error("Failed to fetch chapter pages", error);
    return notFound();
  }

  const pages = data.pages.pages;

  return (
    <MangaReader
      mangaId={mangaId}
      mangaTitle={mangaId}
      chapterId={chapterId}
      chapterTitle={`Chapter ${chapterId}`}
      pages={pages}
    />
  );
}
