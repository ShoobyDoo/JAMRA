"use client";

import { useState } from "react";
import { Button } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { RefreshCw } from "lucide-react";
import { clearChaptersCache } from "@/lib/api";

interface ClearChaptersButtonProps {
  mangaId: string;
}

export function ClearChaptersButton({ mangaId }: ClearChaptersButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    modals.openConfirmModal({
      title: "Clear chapter cache?",
      centered: true,
      children:
        "This will force a refresh of chapter data on next load. The page will reload automatically.",
      labels: { confirm: "Clear cache", cancel: "Cancel" },
      confirmProps: { color: "blue" },
      onConfirm: async () => {
        setLoading(true);
        try {
          await clearChaptersCache(mangaId);
          notifications.show({
            title: "Cache cleared",
            message: "Chapter cache has been cleared. Reloading...",
            color: "green",
            autoClose: 2000,
          });
          // Reload the page to fetch fresh chapters
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } catch (error) {
          console.error("Failed to clear chapters:", error);
          notifications.show({
            title: "Failed to clear cache",
            message:
              error instanceof Error
                ? error.message
                : "Unknown error. Please try again.",
            color: "red",
            autoClose: 5000,
          });
          setLoading(false);
        }
      },
    });
  };

  return (
    <Button
      variant="subtle"
      size="xs"
      onClick={handleClear}
      loading={loading}
      leftSection={<RefreshCw size={14} />}
      className="text-muted-foreground hover:text-foreground"
    >
      Clear Chapter Cache
    </Button>
  );
}
