"use client";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { HEADER_HEIGHT, CONTENT_MAX_WIDTH } from "@/lib/constants";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { SearchBar } from "./search-bar";

export function Topbar() {
  const router = useRouter();

  return (
    <div className="flex items-center" style={{ height: HEADER_HEIGHT }}>
      <div
        className={`mx-auto flex h-full w-full items-center gap-3 ${CONTENT_MAX_WIDTH} px-4`}
      >
        <Group gap="xs" className="flex-shrink-0">
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

        <div className="flex-1 min-w-0">
          <Breadcrumb />
        </div>

        <div className="ml-auto hidden md:flex">
          <SearchBar />
        </div>
      </div>
    </div>
  );
}
