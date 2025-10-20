import type { PropsWithChildren } from "react";
import { AppLayout } from "@/components/system/app-layout";
import { PageErrorBoundary } from "@/components/system/error-boundary";

export default function AppShellLayout({ children }: PropsWithChildren) {
  return (
    <PageErrorBoundary>
      <AppLayout>{children}</AppLayout>
    </PageErrorBoundary>
  );
}
