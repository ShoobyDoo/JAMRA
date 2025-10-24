"use client";

import { useState } from "react";
import {
  Modal,
  Button,
  Stack,
  Text,
  Progress,
  Group,
  Switch,
  NumberInput,
  Alert,
} from "@mantine/core";
import { Archive, AlertCircle, CheckCircle, Download } from "lucide-react";
import type { OfflineMangaMetadata } from "@/lib/api/offline";

interface ArchiveDialogProps {
  opened: boolean;
  onClose: () => void;
  selectedManga: OfflineMangaMetadata[];
  selectedChapterIds: Set<string>;
  onArchiveComplete?: () => void;
}

type ArchiveStatus = "idle" | "preparing" | "archiving" | "complete" | "error";

export function ArchiveDialog({
  opened,
  onClose,
  selectedManga,
  selectedChapterIds,
  onArchiveComplete,
}: ArchiveDialogProps) {
  const [status, setStatus] = useState<ArchiveStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Archive options
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeCover, setIncludeCover] = useState(true);
  const [compressionLevel, setCompressionLevel] = useState(6);

  // Calculate what will be archived
  const mangaToArchive = selectedManga.length;
  const chaptersToArchive = selectedManga.reduce((sum, manga) => {
    if (selectedChapterIds.size === 0) {
      // Archive all chapters if no specific chapters selected
      return sum + manga.chapters.length;
    }
    // Count only selected chapters
    return sum + manga.chapters.filter((ch) => selectedChapterIds.has(ch.chapterId)).length;
  }, 0);

  const totalSize = selectedManga.reduce((sum, manga) => {
    if (selectedChapterIds.size === 0) {
      // All chapters
      return sum + manga.chapters.reduce((chSum, ch) => chSum + ch.sizeBytes, 0);
    }
    // Only selected chapters
    return (
      sum +
      manga.chapters
        .filter((ch) => selectedChapterIds.has(ch.chapterId))
        .reduce((chSum, ch) => chSum + ch.sizeBytes, 0)
    );
  }, 0);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  const handleArchive = async () => {
    setStatus("preparing");
    setProgress(0);
    setErrorMessage(null);
    setDownloadUrl(null);

    try {
      // Prepare archive request
      const archiveItems = selectedManga.map((manga) => ({
        extensionId: manga.extensionId,
        mangaId: manga.mangaId,
        chapterIds:
          selectedChapterIds.size === 0
            ? undefined // Archive all chapters
            : manga.chapters
                .filter((ch) => selectedChapterIds.has(ch.chapterId))
                .map((ch) => ch.chapterId),
      }));

      setStatus("archiving");

      // Call archive API
      const response = await fetch("/api/offline/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: archiveItems,
          options: {
            includeMetadata,
            includeCover,
            compressionLevel,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Archive failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Archive failed");
      }

      setDownloadUrl(result.downloadUrl);
      setProgress(100);
      setStatus("complete");
      onArchiveComplete?.();
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create archive",
      );
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      // Trigger download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClose = () => {
    setStatus("idle");
    setProgress(0);
    setErrorMessage(null);
    setDownloadUrl(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <Archive size={20} />
          <Text fw={600}>Archive to ZIP</Text>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="md">
        {/* Summary */}
        <Alert
          icon={<Archive size={16} />}
          title="Archive Summary"
          color="blue"
          variant="light"
        >
          <Stack gap="xs">
            <Text size="sm">
              <strong>{mangaToArchive}</strong>{" "}
              {mangaToArchive === 1 ? "manga" : "manga series"}
            </Text>
            <Text size="sm">
              <strong>{chaptersToArchive}</strong>{" "}
              {chaptersToArchive === 1 ? "chapter" : "chapters"}
            </Text>
            <Text size="sm">
              Estimated size: <strong>{formatBytes(totalSize)}</strong>
            </Text>
          </Stack>
        </Alert>

        {/* Options */}
        {status === "idle" && (
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              Archive Options
            </Text>

            <Switch
              label="Include metadata (titles, descriptions)"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.currentTarget.checked)}
            />

            <Switch
              label="Include cover images"
              checked={includeCover}
              onChange={(e) => setIncludeCover(e.currentTarget.checked)}
            />

            <NumberInput
              label="Compression level"
              description="Higher = smaller file, slower"
              value={compressionLevel}
              onChange={(val) =>
                setCompressionLevel(typeof val === "number" ? val : 6)
              }
              min={0}
              max={9}
              step={1}
            />
          </Stack>
        )}

        {/* Progress */}
        {(status === "preparing" ||
          status === "archiving" ||
          status === "complete") && (
          <Stack gap="sm">
            <Progress
              value={progress}
              size="lg"
              animated={status === "archiving"}
              color={status === "complete" ? "green" : "blue"}
            />
            <Text size="sm" c="dimmed" ta="center">
              {status === "preparing" && "Preparing archive..."}
              {status === "archiving" && "Creating ZIP file..."}
              {status === "complete" && "Archive complete!"}
            </Text>
          </Stack>
        )}

        {/* Success */}
        {status === "complete" && downloadUrl && (
          <Alert
            icon={<CheckCircle size={16} />}
            title="Archive Ready"
            color="green"
            variant="light"
          >
            <Text size="sm">
              Your archive has been created successfully. Click the button below
              to download it.
            </Text>
          </Alert>
        )}

        {/* Error */}
        {status === "error" && errorMessage && (
          <Alert
            icon={<AlertCircle size={16} />}
            title="Archive Failed"
            color="red"
            variant="light"
          >
            <Text size="sm">{errorMessage}</Text>
          </Alert>
        )}

        {/* Actions */}
        <Group justify="flex-end" gap="sm">
          {status === "idle" && (
            <>
              <Button variant="subtle" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                leftSection={<Archive size={16} />}
                onClick={handleArchive}
                disabled={mangaToArchive === 0}
              >
                Create Archive
              </Button>
            </>
          )}

          {(status === "preparing" || status === "archiving") && (
            <Button variant="subtle" onClick={handleClose} disabled>
              Archiving...
            </Button>
          )}

          {status === "complete" && (
            <>
              <Button variant="subtle" onClick={handleClose}>
                Close
              </Button>
              <Button
                leftSection={<Download size={16} />}
                onClick={handleDownload}
                color="green"
              >
                Download ZIP
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <Button variant="subtle" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleArchive}>Retry</Button>
            </>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
