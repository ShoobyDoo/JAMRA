"use client";

import { useEffect } from "react";
import { Button, Stack, Text, Title } from "@mantine/core";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { logger } from "@/lib/logger";

export default function MangaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    logger.error("Manga page error boundary caught error", {
      component: "MangaError",
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Stack align="center" gap="md" className="w-full max-w-2xl text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <Title order={3}>Failed to load manga</Title>
        <Text size="sm" c="dimmed">
          {error.message ||
            "We couldn't load this manga page. It may not exist or there may be a temporary issue."}
        </Text>
        <Stack gap="xs" className="w-full max-w-xs">
          <Button onClick={reset}>Try again</Button>
          <Button variant="light" onClick={() => router.push("/")}>
            Back to discover
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}
