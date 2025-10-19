"use client";

import Link from "next/link";
import { Clock, BookOpen, Heart, Star, Trash2 } from "lucide-react";
import type { EnrichedHistoryEntry } from "@/lib/api";
import type { HistoryViewMode } from "@/store/history";
import { AutoRefreshImage } from "@/components/ui/auto-refresh-image";
import { cn } from "@/lib/utils";

interface HistoryTimelineProps {
  entries: Map<string, EnrichedHistoryEntry[]>;
  viewMode: HistoryViewMode;
}

function getActionIcon(actionType: string) {
  switch (actionType) {
    case "read":
      return <BookOpen className="h-4 w-4" />;
    case "library_add":
      return <Star className="h-4 w-4" />;
    case "library_remove":
      return <Trash2 className="h-4 w-4" />;
    case "favorite":
      return <Heart className="h-4 w-4 fill-current" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function getActionText(entry: EnrichedHistoryEntry): string {
  const mangaTitle = entry.manga?.title ?? "Unknown Manga";
  const chapterNumber = entry.chapter?.chapterNumber ?? entry.chapter?.title ?? "Unknown";

  switch (entry.actionType) {
    case "read":
      return `Read ${chapterNumber} of ${mangaTitle}`;
    case "library_add":
      return `Added ${mangaTitle} to library`;
    case "library_remove":
      return `Removed ${mangaTitle} from library`;
    case "favorite":
      return `Favorited ${mangaTitle}`;
    default:
      return `${entry.actionType} - ${mangaTitle}`;
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HistoryEntryItem({ entry }: { entry: EnrichedHistoryEntry }) {
  const href = entry.manga?.slug
    ? `/manga/${entry.manga.slug}`
    : entry.mangaId
      ? `/manga/${entry.mangaId}`
      : "#";

  return (
    <Link
      href={href}
      className="flex items-start gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
    >
      {/* Cover Image */}
      {entry.manga?.coverUrl && (
        <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded">
          <AutoRefreshImage
            src={entry.manga.coverUrl}
            alt={entry.manga.title}
            className="h-full w-full object-cover"
            width={48}
            height={64}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className="text-muted-foreground mt-0.5">{getActionIcon(entry.actionType)}</div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{getActionText(entry)}</p>
            <p className="text-sm text-muted-foreground mt-1">{formatTime(entry.timestamp)}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function HistoryEntryGrid({ entry }: { entry: EnrichedHistoryEntry }) {
  const href = entry.manga?.slug
    ? `/manga/${entry.manga.slug}`
    : entry.mangaId
      ? `/manga/${entry.mangaId}`
      : "#";

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:bg-accent"
    >
      {entry.manga?.coverUrl && (
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
          <AutoRefreshImage
            src={entry.manga.coverUrl}
            alt={entry.manga.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            width={200}
            height={300}
          />
          <div className="absolute top-2 right-2 rounded-full bg-background/80 p-1.5 backdrop-blur-sm">
            {getActionIcon(entry.actionType)}
          </div>
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-medium line-clamp-2">{entry.manga?.title ?? "Unknown"}</p>
        <p className="text-xs text-muted-foreground mt-1">{formatTime(entry.timestamp)}</p>
      </div>
    </Link>
  );
}

export function HistoryTimeline({ entries, viewMode }: HistoryTimelineProps) {
  if (viewMode === "grid") {
    return (
      <div className="space-y-6">
        {Array.from(entries.entries()).map(([dateLabel, dateEntries]) => (
          <div key={dateLabel}>
            <h2 className="text-lg font-semibold mb-3">{dateLabel}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {dateEntries.map((entry) => (
                <HistoryEntryGrid key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(entries.entries()).map(([dateLabel, dateEntries]) => (
        <div key={dateLabel}>
          <h2 className="text-lg font-semibold mb-3 sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2">
            {dateLabel}
          </h2>
          <div className={cn("space-y-2", viewMode === "list" && "space-y-1")}>
            {dateEntries.map((entry) => (
              <HistoryEntryItem key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
