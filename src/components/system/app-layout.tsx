"use client";

import type { PropsWithChildren } from "react";
import { AppShell } from "@mantine/core";
import { Sidebar } from "@/components/nav/sidebar";
import { Topbar } from "@/components/topbar/topbar";
import { GlobalLoadingOverlay } from "@/components/global-loading-overlay";
import { NavigationListener } from "@/components/navigation-listener";
import { useUIStore } from "@/store/ui";
import {
  SIDEBAR_WIDTH,
  HEADER_HEIGHT,
  CONTENT_MAX_WIDTH,
} from "@/lib/constants";

export function AppLayout({ children }: PropsWithChildren) {
  const collapsed = useUIStore((state) => state.collapsed);
  const navbarWidth = collapsed ? SIDEBAR_WIDTH.COLLAPSED : SIDEBAR_WIDTH.EXPANDED;

  return (
    <>
      <NavigationListener />
      <AppShell
        header={{ height: HEADER_HEIGHT }}
        navbar={{
          width: navbarWidth,
          breakpoint: "sm",
          collapsed: { mobile: false, desktop: false },
        }}
        padding={0}
        styles={{
          header: {
            borderBottom: "1px solid var(--border)",
            backgroundColor: "var(--background)",
          },
          navbar: {
            borderRight: "1px solid var(--border)",
            backgroundColor: "var(--card)",
          },
          main: {
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
          },
        }}
      >
      <AppShell.Header px={0}>
        <Topbar />
      </AppShell.Header>
      <AppShell.Navbar p={0}>
        <Sidebar />
      </AppShell.Navbar>
      <AppShell.Main className="relative overflow-y-auto">
        <GlobalLoadingOverlay scope="content" />
        <div className={`relative mx-auto w-full ${CONTENT_MAX_WIDTH} px-4 py-6`}>
          {children}
        </div>
      </AppShell.Main>
     </AppShell>
    </>
  );
}
