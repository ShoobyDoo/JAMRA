"use client";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ActionIcon, Group, Text, TextInput } from "@mantine/core";
import { useUIStore } from "@/store/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Topbar() {
  const collapsed = useUIStore((state) => state.collapsed);
  const toggleCollapsed = useUIStore((state) => state.toggleCollapsed);

  return (
    <div className="flex h-14 items-center justify-between px-4">
      <Group className="w-[200px] justify-between" align="center">
        <Text fw={600} size="lg">
          JAMRA
        </Text>
        <ActionIcon
          variant="default"
          radius="md"
          aria-label="Toggle sidebar"
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <ChevronRight size={18} aria-hidden />
          ) : (
            <ChevronLeft size={18} aria-hidden />
          )}
        </ActionIcon>
      </Group>
      <Breadcrumb />

      <form
        action="/search"
        method="GET"
        className="hidden md:block"
        role="search"
      >
        <TextInput
          type="search"
          name="q"
          aria-label="Search manga"
          placeholder="Search manga…"
          className="w-64"
          radius="md"
          variant="filled"
        />
      </form>
    </div>
  );
}
