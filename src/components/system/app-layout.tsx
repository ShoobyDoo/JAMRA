"use client";

import type { PropsWithChildren } from "react";
import { AppShell } from "@mantine/core";
import { Sidebar } from "@/components/nav/sidebar";
import { Topbar } from "@/components/topbar/topbar";
import { useUIStore } from "@/store/ui";

export function AppLayout({ children }: PropsWithChildren): JSX.Element {
  const collapsed = useUIStore((state) => state.collapsed);
  const navbarWidth = collapsed ? 72 : 200;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: navbarWidth,
        breakpoint: "sm",
        collapsed: { mobile: false, desktop: false },
      }}
      navbarOffsetBreakpoint="sm"
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
      <AppShell.Header px="md">
        <Topbar />
      </AppShell.Header>
      <AppShell.Navbar p={0}>
        <Sidebar />
      </AppShell.Navbar>
      <AppShell.Main className="overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-6">{children}</div>
      </AppShell.Main>
    </AppShell>
  );
}
