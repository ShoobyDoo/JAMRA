"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/routes";
import { Anchor, Breadcrumbs, Text } from "@mantine/core";

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const items = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const match = routes.find((route) => route.path === href);
    const label = match?.label ?? decodeURIComponent(segment);
    const isLast = index === segments.length - 1;

    return isLast ? (
      <Text key={href} fw={500} size="sm" aria-current="page">
        {label}
      </Text>
    ) : (
      <Anchor
        key={href}
        component={Link}
        href={href}
        size="sm"
        c="dimmed"
        underline="hover"
      >
        {label}
      </Anchor>
    );
  });

  const breadcrumbItems = [
    segments.length === 0 ? (
      <Text key="home" fw={500} size="sm">
        Home
      </Text>
    ) : (
      <Anchor
        key="home"
        component={Link}
        href="/"
        size="sm"
        c="dimmed"
        underline="hover"
      >
        Home
      </Anchor>
    ),
    ...items,
  ];

  return (
    <Breadcrumbs separator="/" separatorMargin="xs">
      {breadcrumbItems}
    </Breadcrumbs>
  );
}
