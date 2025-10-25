import { MangaGridSkeleton } from "@/components/skeletons";

export default function DiscoverLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Discover</h1>
        <p className="text-muted-foreground">
          Browse the newest manga from your active catalog extension.
        </p>
      </div>

      <MangaGridSkeleton count={12} />
    </div>
  );
}
