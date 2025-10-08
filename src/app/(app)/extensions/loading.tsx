import { Skeleton } from "@mantine/core";

export default function ExtensionsLoading() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Extensions</h1>
        <p className="text-muted-foreground">
          Install, enable, disable, and configure catalogue extensions.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <Skeleton height={36} width="100%" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-lg border border-border bg-muted/40 p-4 space-y-3"
            >
              <Skeleton height={18} width="60%" />
              <Skeleton height={14} width="80%" />
              <Skeleton height={12} width="70%" />
              <div className="flex gap-2">
                <Skeleton height={32} width={96} radius="xl" />
                <Skeleton height={32} width={80} radius="xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
