"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/routes";
import { formatChapterSlugForDisplay } from "@/lib/chapter-slug";
import { Anchor, Breadcrumbs, Text } from "@mantine/core";

interface BreadcrumbSegment {
  label: string;
  href?: string;
  isLast: boolean;
}

/**
 * Process pathname into clean breadcrumb segments
 * Handles complex routes like /read/manga-id/chapter/1
 *
 * Examples:
 * - /manga/example-1 → Home / example-1
 * - /read/example-1/chapter/1 → Home / example-1 / Chapter 1
 */
function buildBreadcrumbSegments(pathname: string): BreadcrumbSegment[] {
  const segments = pathname.split("/").filter(Boolean);
  const result: BreadcrumbSegment[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const href = "/" + segments.slice(0, i + 1).join("/");
    const isLast = i === segments.length - 1;

    // Check if this path matches a known route
    const match = routes.find((route) => route.path === href);

    // Handle /read/[slug]/chapter/[chapterSlug] pattern
    if (segment === "chapter" && i > 0 && segments[0] === "read") {
      // This is part of /read/[slug]/chapter/[slug]
      // We'll combine "chapter" with the next segment
      if (i + 1 < segments.length) {
        const chapterSlug = segments[i + 1];
        const combinedHref = "/" + segments.slice(0, i + 2).join("/");
        result.push({
          label: formatChapterSlugForDisplay(chapterSlug),
          href: i + 1 === segments.length - 1 ? undefined : combinedHref,
          isLast: i + 1 === segments.length - 1,
        });
        i++; // Skip the next iteration since we consumed the chapter number
        continue;
      }
    }

    // Handle read route - manga slug should link to /manga/[slug]
    if (segments[0] === "read" && i === 1) {
      const mangaSlug = segment;
      result.push({
        label: decodeURIComponent(mangaSlug),
        href: `/manga/${mangaSlug}`,
        isLast: false,
      });
      continue;
    }

    // Skip dynamic route parent segments that don't have an index page
    if (["manga", "read"].includes(segment) && !isLast) {
      continue;
    }

    result.push({
      label: match?.label ?? decodeURIComponent(segment),
      href: isLast ? undefined : href,
      isLast,
    });
  }

  return result;
}

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = buildBreadcrumbSegments(pathname);

  const breadcrumbItems = [
    segments.length === 0 || segments.every((s) => !s.isLast) ? (
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
    ...segments.map((segment) => {
      const key = segment.href ?? segment.label;

      if (segment.isLast || !segment.href) {
        return (
          <Text key={key} fw={500} size="sm" aria-current={segment.isLast ? "page" : undefined}>
            {segment.label}
          </Text>
        );
      }

      return (
        <Anchor
          key={key}
          component={Link}
          href={segment.href}
          size="sm"
          c="dimmed"
          underline="hover"
        >
          {segment.label}
        </Anchor>
      );
    }),
  ];

  return (
    <Breadcrumbs separator="/" separatorMargin="xs">
      {breadcrumbItems}
    </Breadcrumbs>
  );
}
