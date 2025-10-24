"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Stack,
  TextInput,
  Textarea,
  Group,
  Text,
  Alert,
} from "@mantine/core";
import { Edit, AlertCircle, CheckCircle } from "lucide-react";
import type { OfflineMangaMetadata } from "@/lib/api/offline";
import { notifications } from "@mantine/notifications";

interface MetadataEditorDialogProps {
  opened: boolean;
  onClose: () => void;
  manga: OfflineMangaMetadata | null;
  onUpdate?: () => void;
}

interface EditableMetadata {
  title: string;
  description: string;
  authors: string;
  artists: string;
}

export function MetadataEditorDialog({
  opened,
  onClose,
  manga,
  onUpdate,
}: MetadataEditorDialogProps) {
  const [metadata, setMetadata] = useState<EditableMetadata>({
    title: "",
    description: "",
    authors: "",
    artists: "",
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize metadata when manga changes
  useEffect(() => {
    if (manga) {
      setMetadata({
        title: manga.title || "",
        description: manga.description || "",
        authors: manga.authors?.join(", ") || "",
        artists: manga.artists?.join(", ") || "",
      });
      setHasChanges(false);
    }
  }, [manga]);

  const handleChange = (field: keyof EditableMetadata, value: string) => {
    setMetadata((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!manga) return;

    setSaving(true);

    try {
      // Convert comma-separated strings to arrays
      const updates = {
        title: metadata.title,
        description: metadata.description,
        authors: metadata.authors ? metadata.authors.split(",").map(s => s.trim()).filter(Boolean) : [],
        artists: metadata.artists ? metadata.artists.split(",").map(s => s.trim()).filter(Boolean) : [],
      };

      const response = await fetch(
        `/api/offline/metadata/${manga.extensionId}/${manga.mangaId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update metadata: ${response.statusText}`);
      }

      notifications.show({
        title: "Metadata updated",
        message: "Manga metadata has been successfully updated",
        color: "green",
      });

      setHasChanges(false);
      onUpdate?.();
      onClose();
    } catch (error) {
      notifications.show({
        title: "Failed to update metadata",
        message: error instanceof Error ? error.message : "An error occurred",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmed = confirm("You have unsaved changes. Are you sure you want to close?");
      if (!confirmed) return;
    }
    setHasChanges(false);
    onClose();
  };

  if (!manga) {
    return null;
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <Edit size={20} />
          <Text fw={600}>Edit Metadata</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        <Alert
          icon={<AlertCircle size={16} />}
          title="Note"
          color="blue"
          variant="light"
        >
          <Text size="sm">
            Changes will only affect the offline copy. Original metadata from the
            source will not be modified.
          </Text>
        </Alert>

        {/* Title */}
        <TextInput
          label="Title"
          placeholder="Manga title"
          value={metadata.title}
          onChange={(e) => handleChange("title", e.currentTarget.value)}
          required
        />

        {/* Description */}
        <Textarea
          label="Description"
          placeholder="Manga description"
          value={metadata.description}
          onChange={(e) => handleChange("description", e.currentTarget.value)}
          minRows={4}
          autosize
        />

        {/* Authors */}
        <TextInput
          label="Authors"
          placeholder="Author names (comma-separated)"
          value={metadata.authors}
          onChange={(e) => handleChange("authors", e.currentTarget.value)}
          description="Separate multiple authors with commas"
        />

        {/* Artists */}
        <TextInput
          label="Artists"
          placeholder="Artist names (comma-separated)"
          value={metadata.artists}
          onChange={(e) => handleChange("artists", e.currentTarget.value)}
          description="Separate multiple artists with commas"
        />

        {/* Original values reference */}
        <Alert
          icon={<CheckCircle size={16} />}
          title="Original Values"
          color="gray"
          variant="light"
        >
          <Stack gap="xs">
            <Text size="xs">
              <strong>Title:</strong> {manga.title}
            </Text>
            {manga.description && (
              <Text size="xs" lineClamp={2}>
                <strong>Description:</strong> {manga.description}
              </Text>
            )}
            {manga.authors && manga.authors.length > 0 && (
              <Text size="xs">
                <strong>Authors:</strong> {manga.authors.join(", ")}
              </Text>
            )}
            {manga.artists && manga.artists.length > 0 && (
              <Text size="xs">
                <strong>Artists:</strong> {manga.artists.join(", ")}
              </Text>
            )}
          </Stack>
        </Alert>

        {/* Actions */}
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            loading={saving}
            leftSection={<Edit size={16} />}
          >
            Save Changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
