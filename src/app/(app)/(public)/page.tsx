"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { SegmentedControl, Skeleton } from "@mantine/core";
import { getAllReadingProgress, getEnrichedReadingProgress } from "@/lib/api";
import { ContinueReadingCard } from "@/components/manga/continue-reading-card";
import { hydrateProgressWithDetails } from "@/lib/reading-history";
import { logger } from "@/lib/logger";
import type { EnrichedReadingProgress } from "@/lib/api";

export default function HomePage() {
  const [enrichedHistory, setEnrichedHistory] = useState<EnrichedReadingProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  useEffect(() => {
    // Load view preference from localStorage
    const savedView = localStorage.getItem("continue-reading-view");
    if (savedView === "list" || savedView === "card") {
      setViewMode(savedView);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data = await getEnrichedReadingProgress(12);
        setEnrichedHistory(data);
      } catch (error) {
        logger.error("Failed to fetch enriched reading progress", {
          component: "HomePage",
          action: "load-enriched-progress",
          error: error instanceof Error ? error : new Error(String(error)),
        });
        try {
          const readingHistory = await getAllReadingProgress();
          const hydrated = await hydrateProgressWithDetails(readingHistory);
          setEnrichedHistory(hydrated);
        } catch {
          setEnrichedHistory([]);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleViewChange = (value: string) => {
    const newView = value as "card" | "list";
    setViewMode(newView);
    localStorage.setItem("continue-reading-view", newView);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton height={32} width={200} />
            <Skeleton height={20} width={300} className="mt-2" />
          </div>
          <Skeleton height={40} width={200} />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={140} radius="lg" />
          ))}
        </div>
      </div>
    );
  }

  if (enrichedHistory.length === 0) {
    return (
      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-2xl font-semibold">Continue Reading</h1>
          <p className="text-muted-foreground">
            Pick up where you left off with your manga collection.
          </p>
        </div>
        <div className="max-w-2xl rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Nothing Here Yet</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Start reading manga to see your progress tracked here. Your reading
            history will show which chapters you&apos;ve read and how far
            you&apos;ve gotten in each series.
          </p>
          <Link
            href="/discover"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Discover Manga
          </Link>
        </div>
      </div>
    );
  }

  // Separate available and unavailable manga
  const availableManga = enrichedHistory.filter(
    (item) => !item.error && item.manga,
  );
  const unavailableManga = enrichedHistory.filter(
    (item) => item.error || !item.manga,
  );

  return (
    <div className="space-y-6 p-4">
      {/* Available Manga Section */}
      {availableManga.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold">Continue Reading</h1>
              <p className="text-muted-foreground">
                Pick up where you left off with your manga collection.
              </p>
            </div>

            {/* View Toggle */}
            <SegmentedControl
              value={viewMode}
              onChange={handleViewChange}
              data={[
                {
                  value: "card",
                  label: (
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4" />
                      <span className="hidden sm:inline">Cards</span>
                    </div>
                  ),
                },
                {
                  value: "list",
                  label: (
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      <span className="hidden sm:inline">List</span>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          <div className={viewMode === "list" ? "space-y-2" : "grid gap-3 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]"}>
            {availableManga.map((item, index) => (
              <ContinueReadingCard
                key={`${item.mangaId}:${item.chapterId}`}
                manga={item.manga}
                mangaId={item.mangaId}
                currentChapterId={item.chapterId}
                currentPage={item.currentPage}
                totalPages={item.totalPages}
                lastReadAt={item.lastReadAt}
                error={item.error}
                priority={index === 0}
                viewMode={viewMode}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unavailable Manga Section */}
      {unavailableManga.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold text-muted-foreground">
              Unavailable Manga
            </h2>
            <p className="text-sm text-muted-foreground">
              These manga cannot be loaded because their extensions are disabled
              or unavailable. Enable the required extensions to continue
              reading.
            </p>
          </div>

          <div className={viewMode === "list" ? "space-y-2" : "grid gap-3 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]"}>
            {unavailableManga.map((item) => (
              <ContinueReadingCard
                key={`${item.mangaId}:${item.chapterId}`}
                manga={item.manga}
                mangaId={item.mangaId}
                currentChapterId={item.chapterId}
                currentPage={item.currentPage}
                totalPages={item.totalPages}
                lastReadAt={item.lastReadAt}
                error={item.error}
                viewMode={viewMode}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
