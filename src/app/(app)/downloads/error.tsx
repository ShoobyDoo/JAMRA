"use client";

import { useEffect } from "react";
import { Button, Stack, Text, Title } from "@mantine/core";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

export default function DownloadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Downloads page error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Stack align="center" gap="md" className="text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <Title order={3}>Downloads unavailable</Title>
        <Text size="sm" c="dimmed">
          {error.message ||
            "We couldn't render the downloads view. Please try again."}
        </Text>
        <Stack gap="xs" className="w-full max-w-xs">
          <Button onClick={reset}>Retry</Button>
          <Button variant="light" onClick={() => router.back()}>
            Go back
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}
