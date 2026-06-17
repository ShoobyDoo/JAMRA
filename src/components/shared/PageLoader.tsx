import { Loader, Stack, Text } from "@mantine/core";
import React from "react";

interface PageLoaderProps {
  message?: string;
  minHeight?: number | string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  message,
  minHeight = 200,
}) => {
  return (
    <Stack
      align="center"
      justify="center"
      gap="sm"
      className="w-full py-12"
      style={{ minHeight }}
    >
      <Loader size="lg" />
      {message && (
        <Text size="sm" c="dimmed">
          {message}
        </Text>
      )}
    </Stack>
  );
};
