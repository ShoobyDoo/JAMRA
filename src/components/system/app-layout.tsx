"use client";

import { useMemo, useRef, useEffect } from "react";
import type { PropsWithChildren, CSSProperties } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  // Reset scroll position on route change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo(0, 0);
    }
  }, [pathname]);

  const computedSidebarWidth = collapsed
    ? SIDEBAR_WIDTH.COLLAPSED
    : sidebarWidth;

  const layoutStyle = useMemo<CSSProperties>(
    () => ({
      gridTemplateColumns: `${computedSidebarWidth}px 1fr`,
      gridTemplateRows: `${HEADER_HEIGHT}px 1fr`,
      gridTemplateAreas: '"sidebar header" "sidebar content"',
    }),
    [computedSidebarWidth]
  );

  const sidebarStyle = useMemo<CSSProperties>(
    () => ({
      gridArea: "sidebar",
    }),
    []
  );

  const headerStyle = useMemo<CSSProperties>(
    () => ({
      gridArea: "header",
    }),
    []
  );

  const mainStyle = useMemo<CSSProperties>(
    () => ({
      gridArea: "content",
    }),
    []
  );

  return (
    <HydrationBoundary>
      <div
        className="relative grid h-dvh min-h-0 min-w-[960px] overflow-hidden bg-background text-foreground transition-[grid-template-columns] duration-250 ease-in-out"
        style={layoutStyle}
      >
        <aside
          className="flex min-h-0 flex-col overflow-hidden border-r border-border bg-card transition-colors duration-150 ease-in-out"
          style={sidebarStyle}
        >
          <Sidebar />
        </aside>
        <header
          className="relative border-b border-border bg-background z-10"
          style={headerStyle}
        >
          <Topbar />
        </header>
        <main
          className="relative min-h-0 overflow-hidden bg-background"
          style={mainStyle}
        >
          <div
            ref={scrollContainerRef}
            className="h-full overflow-y-auto overflow-x-hidden"
          >
            <div
              className={`relative mx-auto w-full ${CONTENT_MAX_WIDTH} py-6 px-8`}
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
