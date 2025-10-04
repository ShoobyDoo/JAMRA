import Link from "next/link";

export function NoExtensionsEmptyState() {
  return (
    <div className="max-w-2xl rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">No Extensions Enabled</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Catalog extensions provide manga sources. You need at least one enabled
        extension to discover and read manga.
      </p>
      <Link
        href="/extensions"
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        Browse Extensions
      </Link>
    </div>
  );
}
