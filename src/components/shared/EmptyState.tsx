import { Stack, Text, Title } from "@mantine/core";
import { IconMoodEmpty } from "@tabler/icons-react";
import React, { type ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <Stack align="center" justify="center" gap="xs" className="w-full py-12">
      {icon ?? (
        <IconMoodEmpty
          size={48}
          className="text-gray-400 dark:text-[var(--mantine-color-dimmed)]"
        />
      )}
      <Title order={5} className="text-center">
        {title}
      </Title>
      {description && (
        <Text size="sm" c="dimmed" className="text-center">
          {description}
        </Text>
      )}
      {action && <div className="mt-2">{action}</div>}
    </Stack>
  );
};
