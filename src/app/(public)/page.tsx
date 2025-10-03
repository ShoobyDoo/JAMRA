import Image from "next/image";
import Link from "next/link";
import { fetchCataloguePage } from "@/lib/api";
import { API_CONFIG } from "@/lib/constants";

export default async function HomePage() {
  let catalogue;
  try {
    catalogue = await fetchCataloguePage({ page: 1 });
  } catch {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Home</h1>
        <p className="text-destructive">
          Failed to load catalogue data. Ensure the catalog server is running on
          <code className="ml-1">{API_CONFIG.DEFAULT_URL}</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Latest Updates</h1>
        <p className="text-muted-foreground">
          Browse the newest series provided by the active extension.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {catalogue.items.map((item) => (
          <Link
            key={item.id}
            href={`/manga/${encodeURIComponent(item.id)}`}
            className="group overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
              {item.coverUrl ? (
                <Image
                  src={item.coverUrl}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No cover
                </div>
              )}
            </div>
            <div className="space-y-2 p-4">
              <h2 className="line-clamp-2 text-lg font-semibold leading-tight">
                {item.title}
              </h2>
              {item.description ? (
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-1">
                {(item.tags ?? []).slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
