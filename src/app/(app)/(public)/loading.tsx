import { Skeleton } from "@mantine/core";

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
          <div
            key={index}
            className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-4"
          >
            <div className="flex gap-3">
              <Skeleton height={128} width={96} radius="md" />
              <div className="flex-1 space-y-3">
                <Skeleton height={18} width="80%" />
                <Skeleton height={14} width="60%" />
                <Skeleton height={10} width="90%" />
                <Skeleton height={10} width="70%" />
                <Skeleton height={10} width="75%" />
              </div>
            </div>
            <Skeleton height={12} width="50%" />
          </div>
        ))}
      </div>
    </div>
  );
}
