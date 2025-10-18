"use client";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { useUIStore } from "@/store/ui";
import { HEADER_HEIGHT_CLASS } from "@/lib/constants";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SearchBar } from "./search-bar";

export function Topbar() {
  const router = useRouter();
  const collapsed = useUIStore((state) => state.collapsed);
  const toggleCollapsed = useUIStore((state) => state.toggleCollapsed);

  return (
    <div className={`flex items-center ${HEADER_HEIGHT_CLASS}`}>
      <div className="flex h-full w-full items-center justify-between gap-6 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Tooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <ActionIcon
              variant="default"
              radius="md"
              size="md"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={toggleCollapsed}
            >
              {collapsed ? (
                <PanelLeft size={18} aria-hidden />
              ) : (
                <PanelLeftClose size={18} aria-hidden />
              )}
            </ActionIcon>
          </Tooltip>
          <div className="min-w-0 flex-1">
            <Breadcrumb />
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-4">
          <Group gap="xs" className="flex-shrink-0">
            <Tooltip label="Go back">
              <ActionIcon
                variant="default"
                radius="md"
                size="md"
                aria-label="Go back"
                onClick={() => router.back()}
              >
                <ChevronLeft size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Go forward">
              <ActionIcon
                variant="default"
                radius="md"
                size="md"
                aria-label="Go forward"
                onClick={() => router.forward()}
              >
                <ChevronRight size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Reload page">
              <ActionIcon
                variant="default"
                radius="md"
                size="md"
                aria-label="Reload page"
                onClick={() => window.location.reload()}
              >
                <RotateCw size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          <div className="hidden md:block w-[14rem] lg:w-[16rem]">
            <SearchBar />
          </div>
        </div>
      </div>
    </div>
  );
}
