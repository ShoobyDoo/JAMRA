"use client";

import type { EnrichedLibraryEntry } from "@/lib/api";
import { LibraryCard } from "./library-card";

interface LibraryGridProps {
  entries: EnrichedLibraryEntry[];
  emptyMessage?: string;
}

export function LibraryGrid({
  entries,
  emptyMessage = "No manga in your library",
}: LibraryGridProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg
          className="h-16 w-16 text-muted-foreground mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Your library is empty
        </h3>
        <p className="text-muted-foreground max-w-md">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {entries.map((entry, index) => (
        <LibraryCard key={entry.mangaId} entry={entry} priority={index < 6} />
      ))}
    </div>
  );
}
