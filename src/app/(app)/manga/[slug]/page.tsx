import Image from "next/image";
import { notFound } from "next/navigation";
import { fetchMangaDetails } from "@/lib/api";
import { ChapterList } from "@/components/manga/chapter-list";
import { ExpandableDescription } from "@/components/manga/expandable-description";
import { GenrePills } from "@/components/manga/genre-pills";
import { ContinueReadingButton } from "@/components/manga/continue-reading-button";
import { ClearChaptersButton } from "@/components/manga/clear-chapters-button";

interface MangaPageProps {
  params: Promise<{ slug: string }>;
}

export default async function MangaPage({ params }: MangaPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug ?? "");

  if (!slug) return notFound();

  let data;
  try {
    data = await fetchMangaDetails(slug);
  } catch (error) {
    console.error("Failed to fetch manga details", error);
    return notFound();
  }

  const { details } = data;
  if (!details) return notFound();

  const chapters = details.chapters ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-lg border border-border bg-muted">
          {details.coverUrl ? (
            <Image
              src={details.coverUrl}
              alt={details.title}
              fill
              sizes="(max-width: 1024px) 60vw, 320px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No cover available
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">{details.title}</h1>
            {details.altTitles && details.altTitles.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Also known as: {details.altTitles.join(", ")}
              </p>
            ) : null}
          </div>

          {details.description ? (
            <ExpandableDescription description={details.description} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No description available.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {details.authors && details.authors.length > 0 ? (
              <div>
                <dt className="text-muted-foreground">Author(s)</dt>
                <dd>{details.authors.join(", ")}</dd>
              </div>
            ) : null}
            {details.artists && details.artists.length > 0 ? (
              <div>
                <dt className="text-muted-foreground">Artist(s)</dt>
                <dd>{details.artists.join(", ")}</dd>
              </div>
            ) : null}
            {details.genres && details.genres.length > 0 ? (
              <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                <dt className="text-muted-foreground mb-2">Genres</dt>
                <dd><GenrePills genres={details.genres} /></dd>
              </div>
            ) : null}
            {details.status ? (
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{details.status}</dd>
              </div>
            ) : null}
            {details.rating ? (
              <div>
                <dt className="text-muted-foreground">Rating</dt>
                <dd>{details.rating.toFixed(1)}</dd>
              </div>
            ) : null}
            {details.year ? (
              <div>
                <dt className="text-muted-foreground">Year</dt>
                <dd>{details.year}</dd>
              </div>
            ) : null}
          </dl>

          {details.links && Object.keys(details.links).length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Links
              </h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(details.links).map(([label, url]) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-secondary px-3 py-1 text-xs text-secondary-foreground transition hover:bg-secondary/80"
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">Chapters</h2>
            <p className="text-sm text-muted-foreground">
              {chapters.length} chapter{chapters.length === 1 ? "" : "s"}{" "}
              available.
            </p>
          </div>
          <ClearChaptersButton mangaId={slug} />
        </div>

        <ContinueReadingButton chapters={chapters} mangaSlug={slug} />
        <ChapterList chapters={chapters} mangaSlug={slug} />
      </div>
    </div>
  );
}
