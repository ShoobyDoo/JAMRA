"use client";

import React from "react";
import { Button, Stack, Text, Title } from "@mantine/core";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    if (process.env.NODE_ENV !== "production") {
      logger.error("React error boundary captured an error", {
        component: "ErrorBoundary",
        error,
        errorInfo,
      });
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      // Default fallback UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-md">
            <Stack align="center" gap="lg">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>

              <div className="text-center">
                <Title order={2} className="mb-2">
                  Something went wrong
                </Title>
                <Text size="sm" c="dimmed" className="mb-4">
                  {this.state.error.message ||
                    "An unexpected error occurred. Please try refreshing the page."}
                </Text>

                {process.env.NODE_ENV !== "production" && (
                  <details className="mt-4 rounded-md border border-border bg-muted p-3 text-left">
                    <summary className="cursor-pointer text-sm font-medium">
                      Error details
                    </summary>
                    <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>

              <Stack gap="sm" className="w-full">
                <Button
                  onClick={this.reset}
                  leftSection={<RefreshCw size={16} />}
                  fullWidth
                >
                  Try again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = "/")}
                  fullWidth
                >
                  Go to homepage
                </Button>
              </Stack>
            </Stack>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Convenience wrapper for common use cases
export function PageErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <div className="w-full max-w-md text-center">
            <Stack align="center" gap="md">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <div>
                <Title order={3} className="mb-2">
                  Failed to load page
                </Title>
                <Text size="sm" c="dimmed">
                  {error.message}
                </Text>
              </div>
              <Button onClick={reset} size="sm">
                Try again
              </Button>
            </Stack>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

// Compact error boundary for reader
export function ReaderErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="fixed inset-0 flex items-center justify-center bg-background">
          <div className="max-w-md p-6 text-center">
            <Stack align="center" gap="md">
              <AlertTriangle className="h-12 w-12 text-destructive" />
              <div>
                <Title order={3} className="mb-2">
                  Reader error
                </Title>
                <Text size="sm" c="dimmed" className="mb-4">
                  {error.message || "Failed to load the manga reader."}
                </Text>
              </div>
              <Stack gap="xs" className="w-full">
                <Button onClick={reset} fullWidth>
                  Retry
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                  fullWidth
                >
                  Go back
                </Button>
              </Stack>
            </Stack>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

interface DataErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function DataErrorBoundary({
  children,
  title = "Something went wrong",
  description = "We couldn't load this section. Please try again.",
  retryLabel = "Retry",
  onRetry,
}: DataErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => {
        const handleRetry = () => {
          onRetry?.();
          reset();
        };

        return (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-4 text-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <Stack gap="xs" align="center">
              <Title order={5} className="text-base font-semibold">
                {title}
              </Title>
              <Text size="xs" c="dimmed">
                {description}
              </Text>
              {process.env.NODE_ENV !== "production" && (
                <Text size="xs" c="dimmed" className="font-mono">
                  {error.message}
                </Text>
              )}
            </Stack>
            <Button size="xs" onClick={handleRetry}>
              {retryLabel}
            </Button>
          </div>
        );
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
