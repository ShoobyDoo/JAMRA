import Image from "next/image";
import Link from "next/link";
import { fetchCataloguePage } from "@/lib/api";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim();

  if (!query) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-muted-foreground">
          Enter a search term using the top bar to explore the catalogue.
        </p>
      </div>
    );
  }

  let catalogue;
  try {
    catalogue = await fetchCataloguePage({ page: 1, query });
  } catch {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-destructive">
          Failed to load search results for{" "}
          <span className="font-semibold">{query}</span>. Ensure the catalog
          server is running.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-muted-foreground">
          Showing results for <span className="font-semibold">{query}</span>.
        </p>
      </div>

      {catalogue.items.length === 0 ? (
        <p className="text-muted-foreground">No matches found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {catalogue.items.map((item) => (
            <Link
              key={item.id}
              href={`/manga/${encodeURIComponent(item.id)}`}
              className="overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
                {item.coverUrl ? (
                  <Image
                    src={item.coverUrl}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    className="object-cover transition duration-300 hover:scale-105"
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
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {item.description ?? "No description available."}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
