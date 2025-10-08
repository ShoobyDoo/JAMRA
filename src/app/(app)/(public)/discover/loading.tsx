import { Skeleton } from "@mantine/core";

export default function DiscoverLoading() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Discover</h1>
        <p className="text-muted-foreground">
          Browse the newest manga from your active catalog extension.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-card p-3 space-y-3"
          >
            <Skeleton height={160} radius="md" />
            <Skeleton height={14} width="85%" />
            <Skeleton height={12} width="60%" />
            <Skeleton height={10} width="70%" />
          </div>
        ))}
      </div>
    </div>
  );
}
