"use client";

import { useState, useEffect } from "react";
import { BookmarkPlus, BookmarkCheck, Heart } from "lucide-react";
import { Button, Menu, ActionIcon, Group } from "@mantine/core";
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
    <Group gap="xs">
      <Menu shadow="md" width={192}>
        <Menu.Target>
          <Button
            variant={variant}
            size={size}
            loading={isLoading}
            leftSection={
              libraryEntry ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <BookmarkPlus className="h-4 w-4" />
              )
            }
          >
            {libraryEntry
              ? currentStatus?.label ?? "In Library"
              : "Add to Library"}
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          {STATUS_OPTIONS.map((option) => (
            <Menu.Item
              key={option.value}
              onClick={() => handleAddToLibrary(option.value)}
              leftSection={<span>{option.icon}</span>}
              rightSection={
                libraryEntry?.status === option.value ? (
                  <BookmarkCheck className="h-4 w-4" />
                ) : null
              }
              bg={
                libraryEntry?.status === option.value ? "var(--mantine-color-default-hover)" : undefined
              }
            >
              {option.label}
            </Menu.Item>
          ))}

          {libraryEntry && (
            <>
              <Menu.Divider />
              <Menu.Item color="red" onClick={handleRemoveFromLibrary}>
                Remove from Library
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      {libraryEntry && (
        <ActionIcon
          variant={libraryEntry.favorite ? "filled" : "outline"}
          size="lg"
          onClick={handleToggleFavorite}
          loading={isLoading}
          title={
            libraryEntry.favorite ? "Remove from favorites" : "Add to favorites"
          }
        >
          <Heart
            className={`h-4 w-4 ${libraryEntry.favorite ? "fill-current" : ""}`}
          />
        </ActionIcon>
      )}
    </Group>
  );
}
