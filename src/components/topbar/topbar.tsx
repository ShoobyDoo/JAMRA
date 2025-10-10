"use client";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ActionIcon, Group, Text, Tooltip } from "@mantine/core";
import { useUIStore } from "@/store/ui";
import { SIDEBAR_WIDTH, HEADER_HEIGHT } from "@/lib/constants";
import {
  PanelLeftClose,
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  RotateCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SearchBar } from "./search-bar";

export function Topbar() {
  const collapsed = useUIStore((state) => state.collapsed);
  const toggleCollapsed = useUIStore((state) => state.toggleCollapsed);
  const router = useRouter();

  return (
    <div className="flex items-center" style={{ height: HEADER_HEIGHT }}>
      <div
        className="flex items-center gap-3 px-3"
        style={{ width: SIDEBAR_WIDTH.EXPANDED }}
      >
        <ActionIcon
          variant="default"
          radius="md"
          size="md"
          aria-label="Toggle sidebar"
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <PanelLeftClose size={18} aria-hidden />
          ) : (
            <PanelLeft size={18} aria-hidden />
          )}
        </ActionIcon>
        <div className="flex flex-col flex-1 min-w-0">
          <Text fw={700} size="xl" lts={2}>
            JAMRA
          </Text>
          <Text size="11px" c="dimmed" className="!-mt-1">
            just another manga reader app
          </Text>
        </div>
      </div>

      <div className="mx-2 flex flex-1 items-center gap-2">
        <Group gap="xs" pr="md">
          <Tooltip label="Go back">
            <ActionIcon
              variant="default"
              radius="md"
              size="sm"
              aria-label="Go back"
              onClick={() => router.back()}
            >
              <ChevronLeft size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Go forward">
            <ActionIcon
              variant="default"
              radius="md"
              size="sm"
              aria-label="Go forward"
              onClick={() => router.forward()}
            >
              <ChevronRight size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Reload page">
            <ActionIcon
              variant="default"
              radius="md"
              size="sm"
              aria-label="Reload page"
              onClick={() => window.location.reload()}
            >
              <RotateCw size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Breadcrumb />

        <div className="ml-auto hidden md:block">
          <SearchBar />
        </div>
      </div>
    </div>
  );
}
