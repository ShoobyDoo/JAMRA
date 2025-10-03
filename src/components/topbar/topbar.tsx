"use client";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ActionIcon, Text, TextInput } from "@mantine/core";
import { useUIStore } from "@/store/ui";
import { SIDEBAR_WIDTH, HEADER_HEIGHT } from "@/lib/constants";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Topbar() {
  const collapsed = useUIStore((state) => state.collapsed);
  const toggleCollapsed = useUIStore((state) => state.toggleCollapsed);

  return (
    <div className="flex items-center" style={{ height: HEADER_HEIGHT }}>
      <div
        className="flex items-center justify-between px-3"
        style={{ width: SIDEBAR_WIDTH.EXPANDED }}
      >
        <div className="flex flex-col">
          <Text fw={700} size="xl" lts={2}>
            JAMRA
          </Text>
          <Text size="11px" c="dimmed" className="leading-none !-mt-1">
            just another manga reader app
          </Text>
        </div>
        <ActionIcon
          variant="default"
          radius="md"
          size="md"
          aria-label="Toggle sidebar"
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <ChevronRight size={16} aria-hidden />
          ) : (
            <ChevronLeft size={16} aria-hidden />
          )}
        </ActionIcon>
      </div>

      <div className="mx-2 flex flex-1 items-center">
        <Breadcrumb />

        <form
          action="/search"
          method="GET"
          className="ml-auto hidden md:block"
          role="search"
        >
          <TextInput
            type="search"
            name="q"
            aria-label="Search manga"
            placeholder="Search manga…"
            className="w-72"
            size="sm"
            radius="md"
          />
        </form>
      </div>
    </div>
  );
}
