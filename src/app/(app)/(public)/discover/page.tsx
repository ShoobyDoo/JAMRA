import { fetchCataloguePage, ApiError } from "@/lib/api";
import { NoExtensionsEmptyState } from "@/components/empty-states/no-extensions";
import { API_CONFIG } from "@/lib/constants";
import { MangaCard } from "@/components/manga/manga-card";

export default async function DiscoverPage() {
  let catalogue;
  try {
    // Fetch from hot-updates to show recently updated manga
    catalogue = await fetchCataloguePage({
      page: 1,
      filters: { useHotUpdates: true }
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="space-y-6 p-6">
          <div>
            <h1 className="text-2xl font-semibold">Discover</h1>
            <p className="text-muted-foreground">
              Explore new manga here. Search, browse categories, and find
              something fresh to read.
            </p>
          </div>
          <NoExtensionsEmptyState />
        </div>
      );
    }

    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Discover</h1>
        <p className="text-destructive">
          Failed to load catalogue data. Ensure the catalog server is running
          on<code className="ml-1">{API_CONFIG.DEFAULT_URL}</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Discover</h1>
        <p className="text-muted-foreground">
          Browse the newest manga from your active catalog extension.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {catalogue.items.map((item) => (
          <MangaCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
