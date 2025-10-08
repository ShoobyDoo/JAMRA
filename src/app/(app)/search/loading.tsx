import { Skeleton } from "@mantine/core";

export default function SearchLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Search Results</h1>
          <p className="text-muted-foreground">Loading results…</p>
        </div>
        <Skeleton height={36} width={120} radius="xl" />
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <Skeleton height={18} width="30%" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton height={16} width="60%" />
              <Skeleton height={16} width="70%" />
              <Skeleton height={16} width="40%" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
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
