import Image from "next/image";
import { notFound } from "next/navigation";
import { fetchChapterPages } from "@/lib/api";

interface ReaderPageProps {
  params: { slug: string; number: string };
}

export default async function ReaderPage({ params }: ReaderPageProps) {
  const slug = decodeURIComponent(params.slug ?? "");
  const chapterId = decodeURIComponent(params.number ?? "");

  if (!slug || !chapterId) return notFound();

  let data;
  try {
    data = await fetchChapterPages(slug, chapterId);
  } catch (error) {
    console.error("Failed to fetch chapter pages", error);
    return notFound();
  }

  const pages = data.pages.pages;

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Reading {slug} — Chapter {chapterId}
        </h1>
        <p className="text-muted-foreground">
          Chapter {chapterId} · {pages.length} page
          {pages.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="space-y-6">
        {pages.map((page) => (
          <div
            key={page.index}
            className="overflow-hidden rounded-lg border border-border bg-black"
          >
            <div className="bg-card px-4 py-2 text-sm text-muted-foreground">
              Page {page.index + 1}
            </div>
            <Image
              src={page.url}
              alt={`Page ${page.index + 1}`}
              width={page.width ?? 1080}
              height={page.height ?? 1920}
              className="h-auto w-full object-contain bg-black"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
