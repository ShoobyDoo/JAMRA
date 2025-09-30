import { notFound } from "next/navigation";

interface MangaPageProps {
  params: { slug: string };
}

export default function MangaPage({ params }: MangaPageProps) {
  const { slug } = params;

  if (!slug) return notFound();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Manga: {decodeURIComponent(slug)}
      </h1>
      <p className="text-slate-400">
        This is the manga detail page. It will display manga metadata, chapter
        lists, and actions such as add to library or start reading.
      </p>
    </div>
  );
}
