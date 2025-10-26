"use client";

import { useEffect } from "react";
import { Button, Stack, Text, Title } from "@mantine/core";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { logger } from "@/lib/logger";

export default function PublicAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    logger.error("Public app error boundary caught error", {
      component: "PublicAppError",
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <Stack align="center" gap="md" className="w-full max-w-2xl text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <Title order={3}>We hit a snag</Title>
        <Text size="sm" c="dimmed">
          {error.message || "Something went wrong loading this page."}
        </Text>
        <Stack gap="xs" className="w-full max-w-xs">
          <Button onClick={reset}>Try again</Button>
          <Button variant="light" onClick={() => router.push("/")}>
            Back to home
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}
