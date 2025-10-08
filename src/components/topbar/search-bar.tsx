"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { TextInput, Paper, Text, Loader } from "@mantine/core";
import { Search, X } from "lucide-react";
import { useDebouncedValue } from "@mantine/hooks";
import { fetchCataloguePage } from "@/lib/api";
import { slugify } from "@/lib/slug";
import type { MangaSummary } from "@/lib/api";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function computeRelevance(item: MangaSummary, normalizedQuery: string): number {
  if (!normalizedQuery) return 0;

  const normalizedTitle = normalizeText(item.title);
  if (!normalizedTitle) return -Infinity;

  if (normalizedTitle === normalizedQuery) {
    return 1_000 - normalizedTitle.length;
  }

  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 800 - normalizedTitle.length;
  }

  const index = normalizedTitle.indexOf(normalizedQuery);
  let score = index !== -1 ? 600 - index : 0;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  if (queryTokens.length > 1) {
    const matches = queryTokens.reduce(
      (total, token) => total + (normalizedTitle.includes(token) ? 1 : 0),
      0,
    );
    score += matches * 75;
  }

  if (score === 0) {
    score = -normalizedTitle.length;
  }

  return score;
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [results, setResults] = useState<MangaSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch results when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    fetchCataloguePage({ page: 1, query: debouncedQuery.trim() })
      .then((data) => {
        const normalizedQuery = normalizeText(debouncedQuery.trim());
        const ranked = data.items
          .map((item, index) => ({
            item,
            score: computeRelevance(item, normalizedQuery),
            index,
          }))
          .sort((a, b) => {
            if (b.score === a.score) {
              return a.index - b.index;
            }
            return b.score - a.score;
          })
          .slice(0, 10)
          .map((entry) => entry.item);

        setResults(ranked);
        setShowDropdown(ranked.length > 0);
      })
      .catch(() => {
        setResults([]);
        setShowDropdown(false);
      })
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        setShowDropdown(false);
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, router]
  );

  const handleResultClick = useCallback(
    (manga: MangaSummary) => {
      setShowDropdown(false);
      setQuery("");
      const destination = slugify(manga.slug ?? manga.title) ?? manga.id;
      router.push(`/manga/${encodeURIComponent(destination)}`);
    },
    [router]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  }, []);

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <TextInput
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onFocus={() => {
            if (results.length > 0) {
              setShowDropdown(true);
            }
          }}
          aria-label="Search manga"
          placeholder="Search manga…"
          className="w-96"
          size="sm"
          radius="md"
          leftSection={
            loading ? (
              <Loader size="xs" />
            ) : (
              <Search size={16} className="text-muted-foreground" />
            )
          }
          rightSection={
            query && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center justify-center hover:text-foreground text-muted-foreground transition"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )
          }
        />
      </form>

      {showDropdown && results.length > 0 && (
        <Paper
          ref={dropdownRef}
          shadow="lg"
          radius="md"
          className="absolute top-full mt-2 w-full z-50 border border-border"
          style={{ maxHeight: "500px" }}
        >
          <div className="flex flex-col overflow-y-auto max-h-[500px]">
            {results.map((manga) => (
              <button
                key={manga.id}
                onClick={() => handleResultClick(manga)}
                className="flex cursor-pointer items-start gap-3 p-3 hover:bg-accent transition-colors text-left border-b border-border last:border-b-0"
              >
                <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-muted">
                  {manga.coverUrl ? (
                    <Image
                      src={manga.coverUrl}
                      alt={manga.title}
                      fill
                      sizes="48px"
                      className="object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No cover
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Text size="sm" fw={600} lineClamp={1}>
                    {manga.title}
                  </Text>
                  {manga.description && (
                    <Text size="xs" c="dimmed" lineClamp={2} className="mt-1">
                      {manga.description}
                    </Text>
                  )}
                </div>
              </button>
            ))}
            {results.length === 10 && (
              <button
                onClick={handleSubmit}
                className="p-3 text-center text-sm text-primary hover:bg-accent transition-colors font-medium"
              >
                View all results for &quot;{query}&quot;
              </button>
            )}
          </div>
        </Paper>
      )}
    </div>
  );
}
