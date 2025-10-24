"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  Checkbox,
  Collapse,
  ActionIcon,
  Menu,
  SegmentedControl,
} from "@mantine/core";
import {
  Grid3X3,
  List,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Trash2,
  Download,
  FileText,
  Edit,
  Archive,
  BookMarked,
  Compass,
} from "lucide-react";
import type { OfflineMangaMetadata } from "@/lib/api/offline";
import { useRouter } from "next/navigation";

interface OfflineMangaListProps {
  manga: OfflineMangaMetadata[];
  selectedMangaIds: Set<string>;
  selectedChapterIds: Set<string>;
  onSelectManga: (mangaId: string, checked: boolean) => void;
  onSelectChapter: (chapterId: string, checked: boolean) => void;
  onSelectAllManga: () => void;
  onDeleteManga?: (extensionId: string, mangaId: string) => void;
  onDeleteChapter?: (extensionId: string, mangaId: string, chapterId: string) => void;
  onEditMetadata?: (extensionId: string, mangaId: string) => void;
  onArchiveManga?: (extensionId: string, mangaId: string) => void;
  sortBy?: "title" | "size" | "date" | "chapters";
  sortOrder?: "asc" | "desc";
}

type ViewMode = "grid" | "list";
type SortOption = "title" | "size" | "date" | "chapters";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString();
}

export function OfflineMangaList({
  manga,
  selectedMangaIds,
  selectedChapterIds,
  onSelectManga,
  onSelectChapter,
  onSelectAllManga,
  onDeleteManga,
  onDeleteChapter,
  onEditMetadata,
  onArchiveManga,
  sortBy = "date",
  sortOrder = "desc",
}: OfflineMangaListProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [expandedManga, setExpandedManga] = useState<Set<string>>(new Set());
  const [currentSort, setCurrentSort] = useState<SortOption>(sortBy);
  const [currentSortOrder, setCurrentSortOrder] = useState<"asc" | "desc">(sortOrder);

  // Sort manga
  const sortedManga = useMemo(() => {
    const sorted = [...manga];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (currentSort) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "size":
          const sizeA = a.chapters.reduce((sum, ch) => sum + ch.sizeBytes, 0);
          const sizeB = b.chapters.reduce((sum, ch) => sum + ch.sizeBytes, 0);
          comparison = sizeA - sizeB;
          break;
        case "date":
          comparison = a.lastUpdatedAt - b.lastUpdatedAt;
          break;
        case "chapters":
          comparison = a.chapters.length - b.chapters.length;
          break;
      }

      return currentSortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [manga, currentSort, currentSortOrder]);

  const toggleExpanded = (mangaId: string) => {
    const newExpanded = new Set(expandedManga);
    if (newExpanded.has(mangaId)) {
      newExpanded.delete(mangaId);
    } else {
      newExpanded.add(mangaId);
    }
    setExpandedManga(newExpanded);
  };

  const handleToggleSort = (sort: SortOption) => {
    if (currentSort === sort) {
      setCurrentSortOrder(currentSortOrder === "asc" ? "desc" : "asc");
    } else {
      setCurrentSort(sort);
      setCurrentSortOrder("desc");
    }
  };

  const allSelected = manga.length > 0 && selectedMangaIds.size === manga.length;
  const someSelected = selectedMangaIds.size > 0 && selectedMangaIds.size < manga.length;

  if (manga.length === 0) {
    return (
      <Box className="rounded border border-border bg-background/50 p-8 text-center">
        <Download size={48} className="mx-auto mb-4 text-muted-foreground" />
        <Text size="lg" fw={600} mb="xs">
          No offline manga yet
        </Text>
        <Text size="sm" c="dimmed" mb="md">
          Download some manga from your library to access them offline
        </Text>
        <Group justify="center" gap="sm">
          <Button
            variant="light"
            leftSection={<BookMarked size={16} />}
            onClick={() => router.push("/library")}
          >
            Go to Library
          </Button>
          <Button
            variant="light"
            leftSection={<Compass size={16} />}
            onClick={() => router.push("/discover")}
          >
            Discover Manga
          </Button>
        </Group>
      </Box>
    );
  }

  return (
    <Stack gap="md">
      {/* Toolbar */}
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={() => onSelectAllManga()}
            label={`${selectedMangaIds.size} selected`}
          />

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Button variant="subtle" size="compact-sm">
                Sort: {currentSort} ({currentSortOrder === "asc" ? "↑" : "↓"})
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => handleToggleSort("title")}>
                Title {currentSort === "title" && (currentSortOrder === "asc" ? "↑" : "↓")}
              </Menu.Item>
              <Menu.Item onClick={() => handleToggleSort("size")}>
                Size {currentSort === "size" && (currentSortOrder === "asc" ? "↑" : "↓")}
              </Menu.Item>
              <Menu.Item onClick={() => handleToggleSort("date")}>
                Date {currentSort === "date" && (currentSortOrder === "asc" ? "↑" : "↓")}
              </Menu.Item>
              <Menu.Item onClick={() => handleToggleSort("chapters")}>
                Chapters {currentSort === "chapters" && (currentSortOrder === "asc" ? "↑" : "↓")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <SegmentedControl
          value={viewMode}
          onChange={(value) => setViewMode(value as ViewMode)}
          data={[
            { value: "grid", label: <Grid3X3 size={16} /> },
            { value: "list", label: <List size={16} /> },
          ]}
          size="xs"
        />
      </Group>

      {/* Manga List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedManga.map((item) => {
            const totalSize = item.chapters.reduce((sum, ch) => sum + ch.sizeBytes, 0);
            const isExpanded = expandedManga.has(item.mangaId);
            const isSelected = selectedMangaIds.has(item.mangaId);

            return (
              <Box
                key={item.mangaId}
                className="rounded border border-border bg-background transition-shadow hover:shadow-md"
              >
                <Box className="p-4">
                  <Group gap="xs" mb="sm" wrap="nowrap">
                    <Checkbox
                      checked={isSelected}
                      onChange={(e) => onSelectManga(item.mangaId, e.currentTarget.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Text
                      size="sm"
                      fw={600}
                      lineClamp={2}
                      className="flex-1 cursor-pointer"
                      onClick={() => router.push(`/manga/${item.slug}`)}
                      title={item.title}
                    >
                      {item.title}
                    </Text>
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<FileText size={14} />}
                          onClick={() => router.push(`/manga/${item.slug}`)}
                        >
                          View Manga
                        </Menu.Item>
                        {onEditMetadata && (
                          <Menu.Item
                            leftSection={<Edit size={14} />}
                            onClick={() => onEditMetadata(item.extensionId, item.mangaId)}
                          >
                            Edit Metadata
                          </Menu.Item>
                        )}
                        {onArchiveManga && (
                          <Menu.Item
                            leftSection={<Archive size={14} />}
                            onClick={() => onArchiveManga(item.extensionId, item.mangaId)}
                          >
                            Archive as ZIP
                          </Menu.Item>
                        )}
                        {onDeleteManga && (
                          <>
                            <Menu.Divider />
                            <Menu.Item
                              color="red"
                              leftSection={<Trash2 size={14} />}
                              onClick={() => onDeleteManga(item.extensionId, item.mangaId)}
                            >
                              Delete Manga
                            </Menu.Item>
                          </>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  </Group>

                  <Stack gap="xs">
                    <Group gap="xs">
                      <Badge size="sm" variant="light">
                        {item.chapters.length} chapters
                      </Badge>
                      <Badge size="sm" variant="outline">
                        {formatBytes(totalSize)}
                      </Badge>
                    </Group>

                    <Text size="xs" c="dimmed">
                      {formatDate(item.lastUpdatedAt)}
                    </Text>

                    <Button
                      variant="subtle"
                      size="compact-xs"
                      fullWidth
                      onClick={() => toggleExpanded(item.mangaId)}
                      rightSection={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    >
                      {isExpanded ? "Hide" : "Show"} Chapters
                    </Button>
                  </Stack>
                </Box>

                <Collapse in={isExpanded}>
                  <Box className="border-t border-border p-2">
                    <Stack gap="xs">
                      {item.chapters.map((chapter) => {
                        const isChapterSelected = selectedChapterIds.has(chapter.chapterId);
                        return (
                          <Group
                            key={chapter.chapterId}
                            gap="xs"
                            className="rounded p-2 hover:bg-muted/50"
                            wrap="nowrap"
                          >
                            <Checkbox
                              size="xs"
                              checked={isChapterSelected}
                              onChange={(e) =>
                                onSelectChapter(chapter.chapterId, e.currentTarget.checked)
                              }
                            />
                            <div className="flex-1 min-w-0">
                              <Text size="xs" lineClamp={1} title={chapter.displayTitle}>
                                {chapter.displayTitle}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {formatBytes(chapter.sizeBytes)}
                              </Text>
                            </div>
                            {onDeleteChapter && (
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color="red"
                                onClick={() =>
                                  onDeleteChapter(item.extensionId, item.mangaId, chapter.chapterId)
                                }
                              >
                                <Trash2 size={12} />
                              </ActionIcon>
                            )}
                          </Group>
                        );
                      })}
                    </Stack>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </div>
      ) : (
        <Stack gap="xs">
          {sortedManga.map((item) => {
            const totalSize = item.chapters.reduce((sum, ch) => sum + ch.sizeBytes, 0);
            const isExpanded = expandedManga.has(item.mangaId);
            const isSelected = selectedMangaIds.has(item.mangaId);

            return (
              <Box
                key={item.mangaId}
                className="rounded border border-border bg-background"
              >
                <Group gap="sm" p="md" wrap="nowrap">
                  <Checkbox
                    checked={isSelected}
                    onChange={(e) => onSelectManga(item.mangaId, e.currentTarget.checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <Text
                      size="sm"
                      fw={600}
                      lineClamp={1}
                      className="cursor-pointer"
                      onClick={() => router.push(`/manga/${item.slug}`)}
                      title={item.title}
                    >
                      {item.title}
                    </Text>
                    <Group gap="xs" mt={4}>
                      <Text size="xs" c="dimmed">
                        {item.chapters.length} chapters
                      </Text>
                      <Text size="xs" c="dimmed">
                        •
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatBytes(totalSize)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        •
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatDate(item.lastUpdatedAt)}
                      </Text>
                    </Group>
                  </div>
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    onClick={() => toggleExpanded(item.mangaId)}
                    rightSection={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  >
                    {item.chapters.length}
                  </Button>
                  <Menu shadow="md" width={200}>
                    <Menu.Target>
                      <ActionIcon variant="subtle" size="sm">
                        <MoreVertical size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<FileText size={14} />}
                        onClick={() => router.push(`/manga/${item.slug}`)}
                      >
                        View Manga
                      </Menu.Item>
                      {onEditMetadata && (
                        <Menu.Item
                          leftSection={<Edit size={14} />}
                          onClick={() => onEditMetadata(item.extensionId, item.mangaId)}
                        >
                          Edit Metadata
                        </Menu.Item>
                      )}
                      {onArchiveManga && (
                        <Menu.Item
                          leftSection={<Archive size={14} />}
                          onClick={() => onArchiveManga(item.extensionId, item.mangaId)}
                        >
                          Archive as ZIP
                        </Menu.Item>
                      )}
                      {onDeleteManga && (
                        <>
                          <Menu.Divider />
                          <Menu.Item
                            color="red"
                            leftSection={<Trash2 size={14} />}
                            onClick={() => onDeleteManga(item.extensionId, item.mangaId)}
                          >
                            Delete Manga
                          </Menu.Item>
                        </>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </Group>

                <Collapse in={isExpanded}>
                  <Box className="border-t border-border p-3">
                    <Stack gap="xs">
                      {item.chapters.map((chapter) => {
                        const isChapterSelected = selectedChapterIds.has(chapter.chapterId);
                        return (
                          <Group
                            key={chapter.chapterId}
                            gap="sm"
                            className="rounded p-2 hover:bg-muted/50"
                            wrap="nowrap"
                          >
                            <Checkbox
                              size="xs"
                              checked={isChapterSelected}
                              onChange={(e) =>
                                onSelectChapter(chapter.chapterId, e.currentTarget.checked)
                              }
                            />
                            <div className="flex-1 min-w-0">
                              <Text size="xs" lineClamp={1} title={chapter.displayTitle}>
                                {chapter.displayTitle}
                              </Text>
                            </div>
                            <Text size="xs" c="dimmed">
                              {formatBytes(chapter.sizeBytes)}
                            </Text>
                            {onDeleteChapter && (
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color="red"
                                onClick={() =>
                                  onDeleteChapter(item.extensionId, item.mangaId, chapter.chapterId)
                                }
                              >
                                <Trash2 size={12} />
                              </ActionIcon>
                            )}
                          </Group>
                        );
                      })}
                    </Stack>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
