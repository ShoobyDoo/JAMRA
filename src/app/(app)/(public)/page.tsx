import Link from "next/link";
import { getAllReadingProgress, fetchMangaDetails } from "@/lib/api";
import { ContinueReadingCard } from "@/components/manga/continue-reading-card";

export default async function HomePage() {
  // Fetch reading history from API
  const readingHistory = await getAllReadingProgress().catch(() => []);

  // Fetch manga details for each progress entry
  const enrichedHistory = await Promise.all(
    readingHistory.map(async (progress) => {
      try {
        const { details } = await fetchMangaDetails(progress.mangaId);
        return { ...progress, manga: details, error: null };
      } catch (error) {
        console.error(`Failed to fetch manga details for ${progress.mangaId}:`, error);
        return {
          ...progress,
          manga: null,
          error: error instanceof Error ? error.message : "Failed to fetch manga details"
        };
      }
    })
  );

  if (enrichedHistory.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Continue Reading</h1>
          <p className="text-muted-foreground">
            Pick up where you left off with your manga collection.
          </p>
        </div>
        <div className="max-w-2xl rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Nothing Here Yet</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Start reading manga to see your progress tracked here. Your reading
            history will show which chapters you&apos;ve read and how far
            you&apos;ve gotten in each series.
          </p>
          <Link
            href="/discover"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Discover Manga
          </Link>
        </div>
      </div>
    );
  }

  // Separate available and unavailable manga
  const availableManga = enrichedHistory.filter((item) => !item.error && item.manga);
  const unavailableManga = enrichedHistory.filter((item) => item.error || !item.manga);

  return (
    <div className="space-y-8 p-6">
      {/* Available Manga Section */}
      {availableManga.length > 0 && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Continue Reading</h1>
            <p className="text-muted-foreground">
              Pick up where you left off with your manga collection.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {availableManga.map((item) => (
              <ContinueReadingCard
                key={`${item.mangaId}:${item.chapterId}`}
                manga={item.manga}
                mangaId={item.mangaId}
                currentChapterId={item.chapterId}
                currentPage={item.currentPage}
                totalPages={item.totalPages}
                lastReadAt={item.lastReadAt}
                error={item.error}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unavailable Manga Section */}
      {unavailableManga.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-muted-foreground">
              Unavailable Manga
            </h2>
            <p className="text-sm text-muted-foreground">
              These manga cannot be loaded because their extensions are disabled
              or unavailable. Enable the required extensions to continue reading.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {unavailableManga.map((item) => (
              <ContinueReadingCard
                key={`${item.mangaId}:${item.chapterId}`}
                manga={item.manga}
                mangaId={item.mangaId}
                currentChapterId={item.chapterId}
                currentPage={item.currentPage}
                totalPages={item.totalPages}
                lastReadAt={item.lastReadAt}
                error={item.error}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
