"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Select, MultiSelect, Pagination, Loader } from "@mantine/core";
import { Filter, X } from "lucide-react";
import { fetchCataloguePage } from "@/lib/api";
import type { CatalogueItem } from "@/lib/api";
import { MangaCard } from "@/components/manga/manga-card";

const SORT_OPTIONS = [
  { value: "Popularity", label: "Popularity" },
  { value: "Latest Updates", label: "Latest Updates" },
  { value: "Recently Added", label: "Recently Added" },
  { value: "Alphabet", label: "Alphabetical" },
  { value: "Subscribers", label: "Subscribers" },
];

const STATUS_OPTIONS = [
  { value: "Ongoing", label: "Ongoing" },
  { value: "Complete", label: "Complete" },
  { value: "Hiatus", label: "Hiatus" },
  { value: "Canceled", label: "Canceled" },
];

const TYPE_OPTIONS = [
  { value: "Manga", label: "Manga (Japanese)" },
  { value: "Manhwa", label: "Manhwa (Korean)" },
  { value: "Manhua", label: "Manhua (Chinese)" },
  { value: "OEL", label: "OEL (English)" },
];

const GENRE_OPTIONS = [
  { value: "Action", label: "Action" },
  { value: "Adventure", label: "Adventure" },
  { value: "Comedy", label: "Comedy" },
  { value: "Drama", label: "Drama" },
  { value: "Ecchi", label: "Ecchi" },
  { value: "Fantasy", label: "Fantasy" },
  { value: "Horror", label: "Horror" },
  { value: "Isekai", label: "Isekai" },
  { value: "Martial Arts", label: "Martial Arts" },
  { value: "Mecha", label: "Mecha" },
  { value: "Mystery", label: "Mystery" },
  { value: "Psychological", label: "Psychological" },
  { value: "Romance", label: "Romance" },
  { value: "School Life", label: "School Life" },
  { value: "Sci-fi", label: "Sci-fi" },
  { value: "Seinen", label: "Seinen" },
  { value: "Shoujo", label: "Shoujo" },
  { value: "Shounen", label: "Shounen" },
  { value: "Slice of Life", label: "Slice of Life" },
  { value: "Sports", label: "Sports" },
  { value: "Supernatural", label: "Supernatural" },
];

const EXCLUDE_GENRE_OPTIONS = [
  { value: "Hentai", label: "Hentai" },
  { value: "Adult", label: "Adult" },
  { value: "Smut", label: "Smut" },
  ...GENRE_OPTIONS,
];

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const pageParam = parseInt(searchParams.get("page") || "1", 10);

  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(pageParam);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [sort, setSort] = useState<string>("Popularity");
  const [status, setStatus] = useState<string[]>([]);
  const [type, setType] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [excludeGenres, setExcludeGenres] = useState<string[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    const filters: Record<string, unknown> = { sort };
    if (status.length > 0) filters.status = status;
    if (type.length > 0) filters.type = type;
    if (genres.length > 0) filters.genres = genres;
    if (excludeGenres.length > 0) filters.excludeGenres = excludeGenres;

    fetchCataloguePage({ page: currentPage, query: query.trim(), filters })
      .then((data) => {
        setItems(data.items);
        setHasMore(data.hasMore);
      })
      .catch(() => {
        setError("Failed to load search results");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [query, currentPage, sort, status, type, genres, excludeGenres]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const params = new URLSearchParams(searchParams);
    params.set("page", String(page));
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    setSort("Popularity");
    setStatus([]);
    setType([]);
    setGenres([]);
    setExcludeGenres([]);
  };

  const hasActiveFilters =
    sort !== "Popularity" ||
    status.length > 0 ||
    type.length > 0 ||
    genres.length > 0 ||
    excludeGenres.length > 0;

  if (!query.trim()) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-muted-foreground">
          Enter a search term using the top bar to explore the catalogue.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Search Results</h1>
          <p className="text-muted-foreground">
            {loading ? "Searching..." : `Results for "${query}"`}
          </p>
        </div>
        <Button
          variant={showFilters ? "filled" : "default"}
          leftSection={<Filter size={16} />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters
        </Button>
      </div>

      {showFilters && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Filter Results</h2>
            {hasActiveFilters && (
              <Button
                variant="subtle"
                size="xs"
                leftSection={<X size={14} />}
                onClick={clearFilters}
              >
                Clear all
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Sort by"
              data={SORT_OPTIONS}
              value={sort}
              onChange={(value) => setSort(value || "Popularity")}
              clearable={false}
            />

            <MultiSelect
              label="Status"
              data={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
              placeholder="Any status"
              clearable
            />

            <MultiSelect
              label="Type"
              data={TYPE_OPTIONS}
              value={type}
              onChange={setType}
              placeholder="Any type"
              clearable
            />

            <MultiSelect
              label="Include Genres"
              data={GENRE_OPTIONS}
              value={genres}
              onChange={setGenres}
              placeholder="Select genres"
              searchable
              clearable
            />

            <MultiSelect
              label="Exclude Genres"
              data={EXCLUDE_GENRE_OPTIONS}
              value={excludeGenres}
              onChange={setExcludeGenres}
              placeholder="Exclude genres"
              searchable
              clearable
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No results found. Try adjusting your search or filters.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((item) => (
              <MangaCard key={item.id} item={item} />
            ))}
          </div>

          {(hasMore || currentPage > 1) && (
            <div className="flex justify-center pt-4">
              <Pagination
                value={currentPage}
                onChange={handlePageChange}
                total={hasMore ? currentPage + 1 : currentPage}
                boundaries={1}
                siblings={1}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
