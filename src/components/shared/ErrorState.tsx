import { Alert, Button } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import React, { type ReactNode } from "react";

interface ErrorStateProps {
  title?: string;
  message?: ReactNode;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
  className,
}) => {
  return (
    <Alert
      icon={<IconAlertCircle size={18} />}
      title={title}
      color="red"
      className={className ?? "mx-auto max-w-2xl"}
    >
      <div className="flex flex-col gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button
            variant="light"
            color="red"
            size="xs"
            onClick={onRetry}
            className="self-start"
          >
            Retry
          </Button>
        )}
      </div>
    </Alert>
  );
};
