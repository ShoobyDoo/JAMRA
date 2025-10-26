"use client";

import { useState } from "react";
import {
  Modal,
  Button,
  Stack,
  Text,
  Progress,
  Group,
  Alert,
  FileInput,
  Radio,
  List,
} from "@mantine/core";
import {
  Upload,
  AlertCircle,
  CheckCircle,
  FileArchive,
  AlertTriangle,
} from "lucide-react";
import { logger } from "@/lib/logger";

interface ImportDialogProps {
  opened: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type ImportStatus =
  | "idle"
  | "validating"
  | "importing"
  | "complete"
  | "error";

type ConflictResolution = "skip" | "overwrite" | "rename";

interface ValidationInfo {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manga?: {
    title: string;
    extensionId: string;
    chapterCount: number;
  };
}

export function ImportDialog({
  opened,
  onClose,
  onImportComplete,
}: ImportDialogProps) {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [conflictResolution, setConflictResolution] =
    useState<ConflictResolution>("skip");
  const [validationInfo, setValidationInfo] = useState<ValidationInfo | null>(
    null,
  );
  const [importResult, setImportResult] = useState<{
    mangaId?: string;
    extensionId?: string;
    chaptersImported?: number;
    skipped?: boolean;
  } | null>(null);

  const handleFileSelect = async (file: File | null) => {
    setSelectedFile(file);
    setValidationInfo(null);
    setErrorMessage(null);

    if (!file) {
      return;
    }

    // Auto-validate when file is selected
    await handleValidate(file);
  };

  const handleValidate = async (file: File) => {
    setStatus("validating");
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/offline/import/validate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`);
      }

      const result = await response.json();
      setValidationInfo(result);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to validate archive",
      );
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      return;
    }

    setStatus("importing");
    setProgress(0);
    setProgressMessage("Starting import...");
    setErrorMessage(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("conflictResolution", conflictResolution);

      const response = await fetch("/api/offline/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }

      // Stream progress updates
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read response stream");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "progress") {
              setProgress(data.progress);
              setProgressMessage(data.message || "Importing...");
            } else if (data.type === "complete") {
              setProgress(100);
              setStatus("complete");
              setImportResult(data.result);
              onImportComplete?.();
            } else if (data.type === "error") {
              throw new Error(data.error || "Import failed");
            }
          } catch (error) {
            // JSON parse errors in SSE stream are common when receiving partial data
            logger.debug("Failed to parse SSE data chunk", {
              component: "ImportDialog",
              action: "parse-sse-chunk",
              error: error instanceof Error ? error : new Error(String(error)),
            });
          }
        }
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to import archive",
      );
    }
  };

  const handleClose = () => {
    setStatus("idle");
    setProgress(0);
    setProgressMessage("");
    setErrorMessage(null);
    setSelectedFile(null);
    setValidationInfo(null);
    setImportResult(null);
    onClose();
  };

  const canImport =
    selectedFile &&
    validationInfo?.valid &&
    status !== "importing" &&
    status !== "validating";

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <Upload size={20} />
          <Text fw={600}>Import from ZIP</Text>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="md">
        {/* File Selection */}
        {status !== "complete" && (
          <FileInput
            label="Select ZIP archive"
            placeholder="Choose a ZIP file to import"
            accept=".zip"
            value={selectedFile}
            onChange={handleFileSelect}
            disabled={status === "importing" || status === "validating"}
            leftSection={<FileArchive size={16} />}
          />
        )}

        {/* Validation Status */}
        {status === "validating" && (
          <Alert
            icon={<FileArchive size={16} />}
            title="Validating archive..."
            color="blue"
            variant="light"
          >
            <Text size="sm">Checking archive structure and contents...</Text>
          </Alert>
        )}

        {/* Validation Results */}
        {validationInfo && status !== "complete" && (
          <>
            {validationInfo.valid && validationInfo.manga && (
              <Alert
                icon={<CheckCircle size={16} />}
                title="Archive is valid"
                color="green"
                variant="light"
              >
                <Stack gap="xs">
                  <Text size="sm">
                    <strong>Manga:</strong> {validationInfo.manga.title}
                  </Text>
                  <Text size="sm">
                    <strong>Extension:</strong>{" "}
                    {validationInfo.manga.extensionId}
                  </Text>
                  <Text size="sm">
                    <strong>Chapters:</strong>{" "}
                    {validationInfo.manga.chapterCount}
                  </Text>
                </Stack>
              </Alert>
            )}

            {!validationInfo.valid && (
              <Alert
                icon={<AlertCircle size={16} />}
                title="Invalid archive"
                color="red"
                variant="light"
              >
                <List size="sm">
                  {validationInfo.errors.map((error, i) => (
                    <List.Item key={i}>{error}</List.Item>
                  ))}
                </List>
              </Alert>
            )}

            {validationInfo.warnings.length > 0 && (
              <Alert
                icon={<AlertTriangle size={16} />}
                title="Warnings"
                color="yellow"
                variant="light"
              >
                <List size="sm">
                  {validationInfo.warnings.map((warning, i) => (
                    <List.Item key={i}>{warning}</List.Item>
                  ))}
                </List>
              </Alert>
            )}
          </>
        )}

        {/* Conflict Resolution */}
        {validationInfo?.valid && status !== "complete" && (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              If manga already exists:
            </Text>
            <Radio.Group
              value={conflictResolution}
              onChange={(value) =>
                setConflictResolution(value as ConflictResolution)
              }
            >
              <Stack gap="xs">
                <Radio
                  value="skip"
                  label="Skip (don't import)"
                  description="Leave existing manga unchanged"
                />
                <Radio
                  value="overwrite"
                  label="Overwrite"
                  description="Replace existing manga with imported version"
                />
                <Radio
                  value="rename"
                  label="Keep both"
                  description="Import with a different name"
                />
              </Stack>
            </Radio.Group>
          </Stack>
        )}

        {/* Progress */}
        {status === "importing" && (
          <Stack gap="sm">
            <Progress
              value={progress}
              size="lg"
              animated
              color="blue"
            />
            <Text size="sm" c="dimmed" ta="center">
              {progressMessage}
            </Text>
          </Stack>
        )}

        {/* Success */}
        {status === "complete" && importResult && (
          <Alert
            icon={<CheckCircle size={16} />}
            title={importResult.skipped ? "Import skipped" : "Import complete!"}
            color={importResult.skipped ? "yellow" : "green"}
            variant="light"
          >
            <Stack gap="xs">
              {importResult.skipped ? (
                <Text size="sm">
                  Manga already exists and conflict resolution was set to skip.
                </Text>
              ) : (
                <>
                  <Text size="sm">
                    Successfully imported manga with{" "}
                    <strong>{importResult.chaptersImported || 0}</strong>{" "}
                    chapter{importResult.chaptersImported !== 1 ? "s" : ""}.
                  </Text>
                  {importResult.mangaId && (
                    <Text size="sm" c="dimmed">
                      Manga ID: {importResult.mangaId}
                    </Text>
                  )}
                </>
              )}
            </Stack>
          </Alert>
        )}

        {/* Error */}
        {status === "error" && errorMessage && (
          <Alert
            icon={<AlertCircle size={16} />}
            title="Import Failed"
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
                leftSection={<Upload size={16} />}
                onClick={handleImport}
                disabled={!canImport}
              >
                Import
              </Button>
            </>
          )}

          {status === "validating" && (
            <Button variant="subtle" disabled>
              Validating...
            </Button>
          )}

          {status === "importing" && (
            <Button variant="subtle" disabled>
              Importing...
            </Button>
          )}

          {status === "complete" && (
            <Button onClick={handleClose}>Close</Button>
          )}

          {status === "error" && (
            <>
              <Button variant="subtle" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleImport} disabled={!canImport}>
                Retry
              </Button>
            </>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
