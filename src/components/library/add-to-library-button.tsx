"use client";

import { useState, useEffect } from "react";
import { BookmarkPlus, BookmarkCheck, Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLibrary } from "@/store/library";
import type { LibraryStatus } from "@/lib/api";
import { logger } from "@/lib/logger";

interface AddToLibraryButtonProps {
  mangaId: string;
  extensionId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

const STATUS_OPTIONS: { value: LibraryStatus; label: string; icon?: string }[] =
  [
    { value: "reading", label: "Reading", icon: "📖" },
    { value: "plan_to_read", label: "Plan to Read", icon: "📚" },
    { value: "completed", label: "Completed", icon: "✅" },
    { value: "on_hold", label: "On Hold", icon: "⏸️" },
    { value: "dropped", label: "Dropped", icon: "❌" },
  ];

export function AddToLibraryButton({
  mangaId,
  extensionId,
  variant = "default",
  size = "default",
}: AddToLibraryButtonProps) {
  const {
    addToLibrary,
    updateEntry,
    removeEntry,
    getEntryByMangaId,
    loadLibrary,
  } = useLibrary();
  const [isLoading, setIsLoading] = useState(false);
  const [libraryEntry, setLibraryEntry] = useState(getEntryByMangaId(mangaId));

  useEffect(() => {
    // Check if manga is in library when component mounts
    const entry = getEntryByMangaId(mangaId);
    setLibraryEntry(entry);

    // If not found, try loading from API
    if (!entry) {
      loadLibrary();
    }
  }, [mangaId, getEntryByMangaId, loadLibrary]);

  const handleAddToLibrary = async (status: LibraryStatus) => {
    setIsLoading(true);
    try {
      if (libraryEntry) {
        // Update existing entry
        await updateEntry(mangaId, { status });
      } else {
        // Add new entry
        await addToLibrary(mangaId, extensionId, status);
      }
      // Refresh local state
      const updatedEntry = getEntryByMangaId(mangaId);
      setLibraryEntry(updatedEntry);
    } catch (error) {
      logger.error("Failed to add or update library entry", {
        component: "AddToLibraryButton",
        action: "save-entry",
        mangaId,
        status,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFromLibrary = async () => {
    setIsLoading(true);
    try {
      await removeEntry(mangaId);
      setLibraryEntry(undefined);
    } catch (error) {
      logger.error("Failed to remove library entry", {
        component: "AddToLibraryButton",
        action: "remove-entry",
        mangaId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!libraryEntry) return;

    setIsLoading(true);
    try {
      await updateEntry(mangaId, { favorite: !libraryEntry.favorite });
      const updatedEntry = getEntryByMangaId(mangaId);
      setLibraryEntry(updatedEntry);
    } catch (error) {
      logger.error("Failed to toggle favorite state", {
        component: "AddToLibraryButton",
        action: "toggle-favorite",
        mangaId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentStatus = STATUS_OPTIONS.find(
    (s) => s.value === libraryEntry?.status,
  );

  return (
    <div className="flex gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : libraryEntry ? (
              <>
                <BookmarkCheck className="h-4 w-4 mr-2" />
                {currentStatus?.label ?? "In Library"}
              </>
            ) : (
              <>
                <BookmarkPlus className="h-4 w-4 mr-2" />
                Add to Library
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleAddToLibrary(option.value)}
              className={
                libraryEntry?.status === option.value ? "bg-accent" : ""
              }
            >
              <span className="mr-2">{option.icon}</span>
              {option.label}
              {libraryEntry?.status === option.value && (
                <BookmarkCheck className="ml-auto h-4 w-4" />
              )}
            </DropdownMenuItem>
          ))}

          {libraryEntry && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleRemoveFromLibrary}
                className="text-destructive"
              >
                Remove from Library
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {libraryEntry && (
        <Button
          variant={libraryEntry.favorite ? "default" : "outline"}
          size="icon"
          onClick={handleToggleFavorite}
          disabled={isLoading}
          title={
            libraryEntry.favorite ? "Remove from favorites" : "Add to favorites"
          }
        >
          <Heart
            className={`h-4 w-4 ${libraryEntry.favorite ? "fill-current" : ""}`}
          />
        </Button>
      )}
    </div>
  );
}
