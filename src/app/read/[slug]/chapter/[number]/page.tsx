import { notFound } from "next/navigation";

interface ReaderPageProps {
  params: { slug: string; number: string };
}

export default function ReaderPage({ params }: ReaderPageProps) {
  const { slug, number } = params;

  if (!slug || !number) return notFound();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Reading {decodeURIComponent(slug)} — Chapter {number}
      </h1>
      <p className="text-slate-400">
        This is the manga reader view. It will display chapter images in order,
        along with navigation controls.
      </p>
    </div>
  );
}
