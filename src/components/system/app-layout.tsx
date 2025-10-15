"use client";

import type { PropsWithChildren } from "react";
import { AppShell } from "@mantine/core";
import { Sidebar } from "@/components/nav/sidebar";
import { Topbar } from "@/components/topbar/topbar";
import { useUIStore } from "@/store/ui";
import { ScrollButtons } from "@/components/ui/scroll-buttons";
import { HydrationBoundary } from "@/components/system/hydration-boundary";
import {
  SIDEBAR_WIDTH,
  HEADER_HEIGHT,
  CONTENT_MAX_WIDTH,
} from "@/lib/constants";

export function AppLayout({ children }: PropsWithChildren) {
  const collapsed = useUIStore((state) => state.collapsed);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const navbarWidth = collapsed ? SIDEBAR_WIDTH.COLLAPSED : sidebarWidth;

  return (
    <HydrationBoundary>
      <AppShell
        header={{ height: HEADER_HEIGHT }}
        navbar={{
          width: navbarWidth,
          breakpoint: "sm",
          collapsed: { mobile: false, desktop: false },
        }}
        padding={0}
        styles={{
          root: {
            height: '100vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
          header: {
            borderBottom: "1px solid var(--border)",
            backgroundColor: "var(--background)",
            flexShrink: 0,
            zIndex: 100,
          },
          navbar: {
            borderRight: "1px solid var(--border)",
            backgroundColor: "var(--card)",
            transition: 'width 300ms ease',
            overflow: 'hidden',
            flexShrink: 0,
          },
          main: {
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
            minHeight: 0,
          },
        }}
      >
      <AppShell.Header px={0}>
        <Topbar />
      </AppShell.Header>
      <AppShell.Navbar p={0}>
        <Sidebar />
      </AppShell.Navbar>
      <AppShell.Main className="relative">
        <div className={`relative mx-auto w-full ${CONTENT_MAX_WIDTH} px-4 py-6`}>
          {children}
        </div>
        <ScrollButtons />
      </AppShell.Main>
    </AppShell>
    </HydrationBoundary>
  );
}
