import { ContinueReadingCardSkeleton } from "@/components/skeletons";

export default function HomePageLoading() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Continue Reading</h1>
        <p className="text-muted-foreground">
          Pick up where you left off with your manga collection.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ContinueReadingCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
