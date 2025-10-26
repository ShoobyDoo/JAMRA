import { notFound } from "next/navigation";
import { fetchMangaDetails } from "@/lib/api";
import { ChapterList } from "@/components/manga/chapter-list";
import { ExpandableDescription } from "@/components/manga/expandable-description";
import { GenrePills } from "@/components/manga/genre-pills";
import { ContinueReadingButton } from "@/components/manga/continue-reading-button";
import { ClearChaptersButton } from "@/components/manga/clear-chapters-button";
import { OfflineMangaProvider } from "@/components/manga/offline-manga-context";
import { OfflineDownloadControls } from "@/components/manga/offline-download-controls";
import { AddToLibraryButton } from "@/components/library/add-to-library-button";
import { withChapterSlugs } from "@/lib/chapter-slug";
import { decodeRouteParam, type MangaRouteParams } from "@/lib/routes";
import { logger } from "@/lib/logger";
import { resolveCoverSources } from "@/lib/cover-sources";
import { AutoRefreshImage } from "@/components/ui/auto-refresh-image";
import { MangaDetailsDevInfo } from "@/components/dev/manga-details-dev-info";

interface MangaPageProps {
  params: Promise<MangaRouteParams>;
}

export default async function MangaPage({ params }: MangaPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);

  if (!slug) return notFound();

  let data;
  try {
    data = await fetchMangaDetails(slug);
  } catch (error) {
    logger.error("Failed to fetch manga details", {
      component: "manga-page",
      action: "fetch-details",
      error: error instanceof Error ? error : new Error(String(error)),
      slug,
    });
    return notFound();
  }

  const { details } = data;
  if (!details) return notFound();
  if (!details.id) return notFound();

  const chapters = withChapterSlugs(details.chapters ?? []);
  const mangaId = details.id;
  const canonicalSlug = details.slug ?? slug;
  const { primary: coverPrimary, fallbacks: coverFallbacks } =
    resolveCoverSources(details);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="relative aspect-[3/4] w-full max-w-xs shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {coverPrimary ? (
            <AutoRefreshImage
              src={coverPrimary}
              fallbackUrls={coverFallbacks}
              alt={details.title}
              fill
              sizes="(max-width: 1024px) 60vw, 320px"
              className="object-cover"
              mangaId={mangaId}
              extensionId={data.extensionId}
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

          <dl className="grid grid-cols-6 gap-4 text-sm">
            {details.authors && details.authors.length > 0 ? (
              <div>
                <dt className="text-sm font-semibold text-foreground mb-1">
                  Author(s)
                </dt>
                <dd>{details.authors.join(", ")}</dd>
              </div>
            ) : null}
            {details.artists && details.artists.length > 0 ? (
              <div>
                <dt className="text-sm font-semibold text-foreground mb-1">
                  Artist(s)
                </dt>
                <dd>{details.artists.join(", ")}</dd>
              </div>
            ) : null}

            {details.status ? (
              <div>
                <dt className="text-sm font-semibold text-foreground mb-1">
                  Status
                </dt>
                <dd>{details.status}</dd>
              </div>
            ) : null}
            {details.rating ? (
              <div>
                <dt className="text-sm font-semibold text-foreground mb-1">
                  Rating
                </dt>
                <dd>{details.rating.toFixed(1)}</dd>
              </div>
            ) : null}
            {details.year ? (
              <div>
                <dt className="text-sm font-semibold text-foreground mb-1">
                  Year
                </dt>
                <dd>{details.year}</dd>
              </div>
            ) : null}
            {/* Add to Library Button - positioned after metadata */}
            <div className="col-span-2">
              <AddToLibraryButton
                mangaId={mangaId}
                extensionId={data.extensionId ?? ""}
                variant="default"
                size="sm"
              />
            </div>
            {details.genres && details.genres.length > 0 ? (
              <div className="col-span-6">
                <dt className="text-sm font-semibold text-foreground mb-2">
                  Genres
                </dt>
                <dd>
                  <GenrePills genres={details.genres} />
                </dd>
              </div>
            ) : null}
          </dl>

          {details.links && Object.keys(details.links).length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Links</h2>
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

      <MangaDetailsDevInfo
        mangaId={mangaId}
        extensionId={data.extensionId ?? ""}
        details={details}
      />

      <OfflineMangaProvider
        extensionId={data.extensionId}
        mangaId={mangaId}
        mangaSlug={canonicalSlug}
        mangaTitle={details.title}
        chapters={chapters}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-xl font-semibold">Chapters</h2>
                <p className="text-sm text-muted-foreground">
                  {chapters.length} chapter{chapters.length === 1 ? "" : "s"}{" "}
                  available.
                </p>
              </div>
              <OfflineDownloadControls mode="badge-only" />
            </div>
            <ClearChaptersButton mangaId={mangaId} />
          </div>

          <ContinueReadingButton
            chapters={chapters}
            mangaId={mangaId}
            mangaSlug={canonicalSlug}
          />
          <ChapterList
            chapters={chapters}
            mangaId={mangaId}
            mangaSlug={canonicalSlug}
          />
        </div>
      </OfflineMangaProvider>
    </div>
  );
}
