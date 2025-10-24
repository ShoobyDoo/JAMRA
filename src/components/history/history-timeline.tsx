"use client";

import { useState } from "react";
import { Clock, BookOpen, Heart, Star, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Modal, Collapse, Button } from "@mantine/core";
import type { EnrichedHistoryEntry } from "@/lib/api";
import { AutoRefreshImage } from "@/components/ui/auto-refresh-image";

interface HistoryTimelineProps {
  entries: Map<string, EnrichedHistoryEntry[]>;
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
  const chapterNumber =
    entry.chapter?.chapterNumber ?? entry.chapter?.title ?? "Unknown";

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

function formatFullDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface HistoryEntryItemProps {
  entry: EnrichedHistoryEntry;
  onShowDetails: () => void;
}

function HistoryEntryItem({ entry, onShowDetails }: HistoryEntryItemProps) {
  return (
    <button
      onClick={onShowDetails}
      className="w-full flex items-start gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent text-left"
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
          <div className="text-muted-foreground mt-0.5">
            {getActionIcon(entry.actionType)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{getActionText(entry)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {formatTime(entry.timestamp)}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

interface HistoryDetailsModalProps {
  entry: EnrichedHistoryEntry;
  isOpen: boolean;
  onClose: () => void;
}

function HistoryDetailsModal({
  entry,
  isOpen,
  onClose,
}: HistoryDetailsModalProps) {
  const [metadataExpanded, setMetadataExpanded] = useState(false);

  const mangaHref = entry.manga?.slug
    ? `/manga/${entry.manga.slug}`
    : entry.mangaId
      ? `/manga/${entry.mangaId}`
      : null;

  return (
    <Modal opened={isOpen} onClose={onClose} size="lg" title="History Details">
      <div className="space-y-4">
        {/* Cover and Title */}
        <div className="flex items-start gap-4">
          {entry.manga?.coverUrl && (
            <div className="relative h-32 w-24 flex-shrink-0 overflow-hidden rounded">
              <AutoRefreshImage
                src={entry.manga.coverUrl}
                alt={entry.manga.title}
                className="h-full w-full object-cover"
                width={96}
                height={128}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold">
              {entry.manga?.title ?? "Unknown Manga"}
            </h3>
            {entry.chapter && (
              <p className="text-sm text-muted-foreground mt-1">
                Chapter {entry.chapter.chapterNumber ?? entry.chapter.title}
              </p>
            )}
            {mangaHref && (
              <a
                href={mangaHref}
                className="text-sm text-primary hover:underline mt-2 inline-block"
              >
                View Manga
              </a>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Action:
            </span>
            <div className="flex items-center gap-2">
              {getActionIcon(entry.actionType)}
              <span className="text-sm capitalize">
                {entry.actionType.replace("_", " ")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Date:
            </span>
            <span className="text-sm">{formatFullDate(entry.timestamp)}</span>
          </div>

          {entry.extensionId && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Extension:
              </span>
              <span className="text-sm">{entry.extensionId}</span>
            </div>
          )}

          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div>
              <Button
                variant="subtle"
                size="compact-sm"
                onClick={() => setMetadataExpanded(!metadataExpanded)}
                rightSection={metadataExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                className="mb-2"
              >
                {metadataExpanded ? "Hide" : "Show"} Metadata
              </Button>
              <Collapse in={metadataExpanded}>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
                {/* Note: Metadata content may need review on backend.
                    Library Add actions sometimes show status data that may not be relevant. */}
              </Collapse>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function HistoryTimeline({ entries }: HistoryTimelineProps) {
  const [selectedEntry, setSelectedEntry] =
    useState<EnrichedHistoryEntry | null>(null);

  return (
    <>
      <div className="space-y-6">
        {Array.from(entries.entries()).map(([dateLabel, dateEntries]) => (
          <div key={dateLabel}>
            <h2 className="text-lg font-semibold mb-3 sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2">
              {dateLabel}
            </h2>
            <div className="space-y-2">
              {dateEntries.map((entry) => (
                <HistoryEntryItem
                  key={entry.id}
                  entry={entry}
                  onShowDetails={() => setSelectedEntry(entry)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedEntry && (
        <HistoryDetailsModal
          entry={selectedEntry}
          isOpen={!!selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </>
  );
}
