"use client";

import { useState } from "react";
import { Button } from "@mantine/core";
import { RefreshCw } from "lucide-react";
import { clearChaptersCache } from "@/lib/api";

interface ClearChaptersButtonProps {
  mangaId: string;
}

export function ClearChaptersButton({ mangaId }: ClearChaptersButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    if (!confirm("Clear chapter cache? This will force a refresh of chapter data on next load.")) {
      return;
    }

    setLoading(true);
    try {
      await clearChaptersCache(mangaId);
      // Reload the page to fetch fresh chapters
      window.location.reload();
    } catch (error) {
      console.error("Failed to clear chapters:", error);
      alert("Failed to clear chapter cache. Please try again.");
      setLoading(false);
    }
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
