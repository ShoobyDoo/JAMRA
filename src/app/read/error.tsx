"use client";

import { useEffect } from "react";
import { Button, Stack, Text, Title } from "@mantine/core";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { logger } from "@/lib/logger";

export default function ReaderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    logger.error("Reader error boundary caught error", {
      component: "ReaderError",
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Stack align="center" gap="md" className="text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <Title order={2}>Reader error</Title>
        <Text size="sm" c="dimmed" className="max-w-md">
          {error.message ||
            "The reader encountered an unexpected error. This chapter may be unavailable or corrupted."}
        </Text>
        <Stack gap="xs" className="w-full max-w-xs">
          <Button onClick={reset}>Retry chapter</Button>
          <Button variant="light" onClick={() => router.back()}>
            Go back
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}
