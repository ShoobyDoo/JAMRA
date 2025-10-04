import type { PropsWithChildren } from "react";
import { AppLayout } from "@/components/system/app-layout";

export default function AppShellLayout({ children }: PropsWithChildren) {
  return <AppLayout>{children}</AppLayout>;
}
