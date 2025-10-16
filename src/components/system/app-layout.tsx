"use client";

import { useMemo, useRef } from "react";
import type { PropsWithChildren, CSSProperties } from "react";
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const computedSidebarWidth = collapsed
    ? SIDEBAR_WIDTH.COLLAPSED
    : sidebarWidth;

  const layoutStyle = useMemo<CSSProperties>(
    () => ({
      display: "grid",
      gridTemplateColumns: `${computedSidebarWidth}px 1fr`,
      gridTemplateRows: `${HEADER_HEIGHT}px 1fr`,
      gridTemplateAreas: '"sidebar header" "sidebar content"',
      height: "100dvh",
      minHeight: 0,
      minWidth: "960px",
      overflow: "hidden",
      transition: "grid-template-columns 250ms ease",
      backgroundColor: "var(--background)",
      color: "var(--foreground)",
    }),
    [computedSidebarWidth],
  );

  const sidebarStyle = useMemo<CSSProperties>(
    () => ({
      gridArea: "sidebar",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      borderRight: "1px solid var(--border)",
      backgroundColor: "var(--card)",
      overflow: "hidden",
      transition: "background-color 150ms ease",
    }),
    [],
  );

  const headerStyle = useMemo<CSSProperties>(
    () => ({
      gridArea: "header",
      borderBottom: "1px solid var(--border)",
      backgroundColor: "var(--background)",
      position: "relative",
      zIndex: 10,
      display: "flex",
    }),
    [],
  );

  const mainStyle = useMemo<CSSProperties>(
    () => ({
      gridArea: "content",
      minHeight: 0,
      overflow: "hidden",
      position: "relative",
      backgroundColor: "var(--background)",
    }),
    [],
  );

  return (
    <HydrationBoundary>
      <div className="relative" style={layoutStyle}>
        <aside style={sidebarStyle}>
          <Sidebar />
        </aside>
        <header style={headerStyle}>
          <Topbar />
        </header>
        <main style={mainStyle}>
          <div
            ref={scrollContainerRef}
            className="h-full overflow-y-auto overflow-x-hidden"
          >
            <div
              className={`relative mx-auto w-full ${CONTENT_MAX_WIDTH} px-4 py-6`}
            >
              {children}
            </div>
          </div>
          <ScrollButtons containerRef={scrollContainerRef} />
        </main>
      </div>
    </HydrationBoundary>
  );
}
