import Link from "next/link";

export default async function HomePage() {
  // TODO: Fetch user's reading history once that API is implemented
  const readingHistory: never[] = [];

  if (readingHistory.length === 0) {
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

  // TODO: Render reading history with progress bars
  // Each manga card should show:
  // - Cover image
  // - Title
  // - Progress bar (read chapters / total chapters)
  // - "Continue Reading" button linking to next unread chapter
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Continue Reading</h1>
        <p className="text-muted-foreground">
          Pick up where you left off with your manga collection.
        </p>
      </div>
      {/* Reading history grid will go here */}
    </div>
  );
}
