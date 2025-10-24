"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Text, Stack, Skeleton, Group, Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  getOfflineManga,
  getStorageStats,
  deleteOfflineManga,
  deleteOfflineChapter,
  type OfflineMangaMetadata,
  type StorageStats,
} from "@/lib/api/offline";
import { logger } from "@/lib/logger";
import { StorageDashboard } from "./storage-dashboard";
import { OfflineMangaList } from "./offline-manga-list";
import { OfflineSearch, type SearchFilters } from "./offline-search";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { ArchiveDialog } from "./archive-dialog";
import { ImportDialog } from "./import-dialog";
import { MetadataEditorDialog } from "./metadata-editor-dialog";
import { StorageSettingsComponent } from "./storage-settings";
import { SchedulerPanel } from "./scheduler-panel";

export function ManagerTab() {
  const [loading, setLoading] = useState(true);
  const [offlineManga, setOfflineManga] = useState<OfflineMangaMetadata[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  // Selection state
  const [selectedMangaIds, setSelectedMangaIds] = useState<Set<string>>(new Set());
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());

  // Search/filter state
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: "",
    extensions: [],
  });

  // Archive dialog state
  const [archiveDialogOpened, setArchiveDialogOpened] = useState(false);

  // Import dialog state
  const [importDialogOpened, setImportDialogOpened] = useState(false);

  // Metadata editor state
  const [metadataEditorOpened, setMetadataEditorOpened] = useState(false);
  const [editingManga, setEditingManga] = useState<OfflineMangaMetadata | null>(null);

  // Load offline manga data
  useEffect(() => {
    loadOfflineData();
  }, []);

  // Get available extensions from manga list
  const availableExtensions = useMemo(() => {
    const extensions = new Set<string>();
    offlineManga.forEach((manga) => extensions.add(manga.extensionId));
    return Array.from(extensions).sort();
  }, [offlineManga]);

  // Filter manga based on search criteria
  const filteredManga = useMemo(() => {
    let filtered = offlineManga;

    // Filter by search query
    if (searchFilters.query) {
      const query = searchFilters.query.toLowerCase();
      filtered = filtered.filter((manga) =>
        manga.title.toLowerCase().includes(query),
      );
    }

    // Filter by extensions
    if (searchFilters.extensions.length > 0) {
      filtered = filtered.filter((manga) =>
        searchFilters.extensions.includes(manga.extensionId),
      );
    }

    // Filter by size
    if (searchFilters.sizeMin || searchFilters.sizeMax) {
      filtered = filtered.filter((manga) => {
        const totalSize = manga.chapters.reduce((sum, ch) => sum + ch.sizeBytes, 0);
        if (searchFilters.sizeMin && totalSize < searchFilters.sizeMin) return false;
        if (searchFilters.sizeMax && totalSize > searchFilters.sizeMax) return false;
        return true;
      });
    }

    // Filter by date
    if (searchFilters.dateFrom) {
      filtered = filtered.filter((manga) =>
        manga.lastUpdatedAt >= searchFilters.dateFrom!,
      );
    }

    if (searchFilters.dateTo) {
      filtered = filtered.filter((manga) =>
        manga.lastUpdatedAt <= searchFilters.dateTo!,
      );
    }

    return filtered;
  }, [offlineManga, searchFilters]);

  const loadOfflineData = async () => {
    try {
      setLoading(true);
      const [manga, stats] = await Promise.all([
        getOfflineManga(),
        getStorageStats(),
      ]);
      setOfflineManga(manga);
      setStorageStats(stats);
      setLoading(false);
    } catch (error) {
      logger.error("Failed to load offline manga data", {
        component: "ManagerTab",
        action: "load-offline-data",
        error: error instanceof Error ? error : new Error(String(error)),
      });
      setLoading(false);

      notifications.show({
        title: "Failed to load offline data",
        message: error instanceof Error ? error.message : "An error occurred",
        color: "red",
      });
    }
  };

  // Selection handlers
  const handleSelectManga = useCallback((mangaId: string, checked: boolean) => {
    setSelectedMangaIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(mangaId);
      } else {
        newSet.delete(mangaId);
      }
      return newSet;
    });
  }, []);

  const handleSelectChapter = useCallback((chapterId: string, checked: boolean) => {
    setSelectedChapterIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(chapterId);
      } else {
        newSet.delete(chapterId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAllManga = useCallback(() => {
    if (selectedMangaIds.size === offlineManga.length) {
      setSelectedMangaIds(new Set());
    } else {
      setSelectedMangaIds(new Set(offlineManga.map((m) => m.mangaId)));
    }
  }, [offlineManga, selectedMangaIds.size]);

  // Delete handlers
  const handleDeleteManga = useCallback(async (extensionId: string, mangaId: string) => {
    try {
      await deleteOfflineManga(extensionId, mangaId);
      setOfflineManga((prev) => prev.filter((m) => m.mangaId !== mangaId));
      setSelectedMangaIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(mangaId);
        return newSet;
      });
      // Reload storage stats
      const stats = await getStorageStats();
      setStorageStats(stats);

      notifications.show({
        title: "Manga deleted",
        message: "Manga and all its chapters have been removed",
        color: "green",
      });
    } catch (error) {
      logger.error("Failed to delete manga", {
        component: "ManagerTab",
        action: "delete-manga",
        extensionId,
        mangaId,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      notifications.show({
        title: "Failed to delete manga",
        message: error instanceof Error ? error.message : "An error occurred",
        color: "red",
      });
    }
  }, []);

  const handleDeleteChapter = useCallback(async (
    extensionId: string,
    mangaId: string,
    chapterId: string,
  ) => {
    try {
      await deleteOfflineChapter(extensionId, mangaId, chapterId);
      // Update the manga's chapters list
      setOfflineManga((prev) =>
        prev.map((m) => {
          if (m.mangaId === mangaId) {
            return {
              ...m,
              chapters: m.chapters.filter((ch) => ch.chapterId !== chapterId),
            };
          }
          return m;
        }),
      );
      setSelectedChapterIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(chapterId);
        return newSet;
      });
      // Reload storage stats
      const stats = await getStorageStats();
      setStorageStats(stats);

      notifications.show({
        title: "Chapter deleted",
        message: "Chapter has been removed from offline storage",
        color: "green",
      });
    } catch (error) {
      logger.error("Failed to delete chapter", {
        component: "ManagerTab",
        action: "delete-chapter",
        extensionId,
        mangaId,
        chapterId,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      notifications.show({
        title: "Failed to delete chapter",
        message: error instanceof Error ? error.message : "An error occurred",
        color: "red",
      });
    }
  }, []);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selectedMangaIds.size === 0 && selectedChapterIds.size === 0) return;

    const totalCount = selectedMangaIds.size + selectedChapterIds.size;

    try {
      // Delete selected manga
      const deleteMangaPromises = Array.from(selectedMangaIds).map((mangaId) => {
        const manga = offlineManga.find((m) => m.mangaId === mangaId);
        if (manga) {
          return deleteOfflineManga(manga.extensionId, manga.mangaId);
        }
        return Promise.resolve();
      });

      // Delete selected chapters
      const deleteChapterPromises = Array.from(selectedChapterIds).map((chapterId) => {
        // Find the manga that contains this chapter
        for (const manga of offlineManga) {
          const chapter = manga.chapters.find((ch) => ch.chapterId === chapterId);
          if (chapter) {
            return deleteOfflineChapter(manga.extensionId, manga.mangaId, chapterId);
          }
        }
        return Promise.resolve();
      });

      await Promise.all([...deleteMangaPromises, ...deleteChapterPromises]);

      // Update state
      setOfflineManga((prev) =>
        prev
          .filter((m) => !selectedMangaIds.has(m.mangaId))
          .map((m) => ({
            ...m,
            chapters: m.chapters.filter((ch) => !selectedChapterIds.has(ch.chapterId)),
          })),
      );

      // Clear selections
      setSelectedMangaIds(new Set());
      setSelectedChapterIds(new Set());

      // Reload storage stats
      const stats = await getStorageStats();
      setStorageStats(stats);

      notifications.show({
        title: "Bulk delete successful",
        message: `Successfully deleted ${totalCount} item${totalCount !== 1 ? "s" : ""}`,
        color: "green",
      });
    } catch (error) {
      logger.error("Failed to bulk delete", {
        component: "ManagerTab",
        action: "bulk-delete",
        selectedMangaCount: selectedMangaIds.size,
        selectedChapterCount: selectedChapterIds.size,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      notifications.show({
        title: "Bulk delete failed",
        message: error instanceof Error ? error.message : "An error occurred",
        color: "red",
      });
    }
  }, [selectedMangaIds, selectedChapterIds, offlineManga]);

  const handleClearSelection = useCallback(() => {
    setSelectedMangaIds(new Set());
    setSelectedChapterIds(new Set());
  }, []);

  // Archive handlers
  const handleOpenArchiveDialog = useCallback(() => {
    setArchiveDialogOpened(true);
  }, []);

  const handleCloseArchiveDialog = useCallback(() => {
    setArchiveDialogOpened(false);
  }, []);

  const handleArchiveComplete = useCallback(async () => {
    // Optionally reload data after archiving
    // For now, archiving doesn't modify local data, so no reload needed
  }, []);

  // Get selected manga data for archive dialog
  const selectedMangaData = useMemo(() => {
    return offlineManga.filter((m) => selectedMangaIds.has(m.mangaId));
  }, [offlineManga, selectedMangaIds]);

  // Import handlers
  const handleOpenImportDialog = useCallback(() => {
    setImportDialogOpened(true);
  }, []);

  const handleCloseImportDialog = useCallback(() => {
    setImportDialogOpened(false);
  }, []);

  const handleImportComplete = useCallback(async () => {
    // Reload data after import
    await loadOfflineData();
  }, []);

  // Metadata editor handlers
  const handleOpenMetadataEditor = useCallback((extensionId: string, mangaId: string) => {
    const manga = offlineManga.find((m) => m.mangaId === mangaId);
    if (manga) {
      setEditingManga(manga);
      setMetadataEditorOpened(true);
    }
  }, [offlineManga]);

  const handleCloseMetadataEditor = useCallback(() => {
    setMetadataEditorOpened(false);
    setEditingManga(null);
  }, []);

  const handleMetadataUpdate = useCallback(async () => {
    // Reload data after metadata update
    await loadOfflineData();
  }, []);

  if (loading) {
    return (
      <Stack gap="md">
        <Skeleton height={200} />
        <Skeleton height={400} />
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      {/* Storage Dashboard Section */}
      <Box>
        <Text size="lg" fw={600} mb="md">
          Storage Overview
        </Text>
        <StorageDashboard stats={storageStats} loading={loading} />
      </Box>

      {/* Search & Filter Section */}
      <Box>
        <OfflineSearch
          availableExtensions={availableExtensions}
          onFiltersChange={setSearchFilters}
        />
      </Box>

      {/* Offline Manga List Section */}
      <Box>
        <Text size="lg" fw={600} mb="md">
          Offline Library ({filteredManga.length}{filteredManga.length !== offlineManga.length ? ` of ${offlineManga.length}` : ""})
        </Text>
        <OfflineMangaList
          manga={filteredManga}
          selectedMangaIds={selectedMangaIds}
          selectedChapterIds={selectedChapterIds}
          onSelectManga={handleSelectManga}
          onSelectChapter={handleSelectChapter}
          onSelectAllManga={handleSelectAllManga}
          onDeleteManga={handleDeleteManga}
          onDeleteChapter={handleDeleteChapter}
          onEditMetadata={handleOpenMetadataEditor}
        />
      </Box>

      {/* Storage Settings Section */}
      <Box>
        <Text size="lg" fw={600} mb="md">
          Storage Settings
        </Text>
        <Box className="rounded border border-border bg-background/50 p-4">
          <Stack gap="md">
            <Box>
              <Text size="sm" fw={600} mb="xs">
                Import / Export
              </Text>
              <Group gap="sm">
                <Button
                  size="sm"
                  variant="light"
                  onClick={handleOpenImportDialog}
                >
                  Import from ZIP
                </Button>
              </Group>
            </Box>
            <Box>
              <Text size="sm" fw={600} mb="xs">
                Storage Management
              </Text>
              <StorageSettingsComponent stats={storageStats} />
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* Download Scheduler Section */}
      <Box>
        <Text size="lg" fw={600} mb="md">
          Download Scheduler
        </Text>
        <Box className="rounded border border-border bg-background/50 p-4">
          <SchedulerPanel />
        </Box>
      </Box>

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedMangaIds.size + selectedChapterIds.size}
        totalCount={offlineManga.length + offlineManga.reduce((sum, m) => sum + m.chapters.length, 0)}
        onClearSelection={handleClearSelection}
        onDelete={handleBulkDelete}
        onArchive={handleOpenArchiveDialog}
      />

      {/* Archive Dialog */}
      <ArchiveDialog
        opened={archiveDialogOpened}
        onClose={handleCloseArchiveDialog}
        selectedManga={selectedMangaData}
        selectedChapterIds={selectedChapterIds}
        onArchiveComplete={handleArchiveComplete}
      />

      {/* Import Dialog */}
      <ImportDialog
        opened={importDialogOpened}
        onClose={handleCloseImportDialog}
        onImportComplete={handleImportComplete}
      />

      {/* Metadata Editor Dialog */}
      <MetadataEditorDialog
        opened={metadataEditorOpened}
        onClose={handleCloseMetadataEditor}
        manga={editingManga}
        onUpdate={handleMetadataUpdate}
      />
    </Stack>
  );
}
