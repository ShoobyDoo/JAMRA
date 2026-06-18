import React from "react";
import { Link, useLocation } from "react-router";
import { Breadcrumbs as MantineBreadcrumbs } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { ROUTE_LABELS } from "../../constants/routes";
import { useLibraryItem } from "../../hooks/queries/useLibraryQueries";
import { useExtensionManga } from "../../hooks/queries/useExtensionsQueries";
import { buildRoute } from "../../routes/routes.config";

interface BreadcrumbSegment {
  label: string;
  path: string | null;
}

const prettify = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  return value.replace(/-/g, " ");
};

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const readerLibraryId = React.useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    const readerIndex = segments.indexOf("reader");
    if (readerIndex === -1) {
      return undefined;
    }
    return segments[readerIndex + 1];
  }, [location.pathname]);
  const { data: readerLibraryItem } = useLibraryItem(readerLibraryId);

  // Resolve real manga title for /manga/:extensionId/:mangaId breadcrumbs
  // from the TanStack Query cache, instead of slugifying the route param.
  const mangaRouteParams = React.useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    const mangaIndex = segments.indexOf("manga");
    if (mangaIndex === -1) {
      return undefined;
    }
    return {
      extensionId: segments[mangaIndex + 1],
      mangaId: segments[mangaIndex + 2],
    };
  }, [location.pathname]);
  const { data: mangaDetails } = useExtensionManga(
    mangaRouteParams?.extensionId,
    mangaRouteParams?.mangaId,
  );

  const segments = React.useMemo(() => {
    const pathSegments = location.pathname.split("/").filter(Boolean);
    const breadcrumbs: BreadcrumbSegment[] = [];

    if (location.pathname !== "/") {
      breadcrumbs.push({ label: "Home", path: "/" });
    }

    let currentPath = "";
    let skipNext = 0;

    pathSegments.forEach((segment, index) => {
      if (skipNext > 0) {
        skipNext--;
        return;
      }

      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      // Handle /manga/:extensionId/:mangaId pattern
      if (segment === "manga" && pathSegments[index + 1]) {
        breadcrumbs.push({
          label: "Discover",
          path: "/discover",
        });

        breadcrumbs.push({
          label: mangaDetails?.manga.title ?? "Details",
          path: null,
        });
        skipNext = 2;
        return;
      }

      // Handle /reader/:libraryId/chapters/:chapterId pattern
      if (segment === "reader" && pathSegments[index + 1]) {
        const mangaDetailsPath = readerLibraryItem
          ? buildRoute.mangaDetails(
              readerLibraryItem.extensionId,
              readerLibraryItem.mangaId,
            )
          : null;

        breadcrumbs.push({
          label: readerLibraryItem?.title ?? "Selected manga",
          path: mangaDetailsPath,
        });

        const chapterId = pathSegments[index + 3];
        breadcrumbs.push({
          label: `Chapter ${prettify(chapterId, "")}`.trim(),
          path: null,
        });

        skipNext = 3;
        return;
      }

      const label =
        ROUTE_LABELS[currentPath as keyof typeof ROUTE_LABELS] ||
        segment.charAt(0).toUpperCase() + segment.slice(1);

      breadcrumbs.push({
        label,
        path: isLast ? null : currentPath,
      });
    });

    if (breadcrumbs.length === 0) {
      breadcrumbs.push({ label: "Home", path: null });
    }

    return breadcrumbs;
  }, [location.pathname, readerLibraryItem, mangaDetails]);

  return (
    <MantineBreadcrumbs
      separator={
        <IconChevronRight
          size={14}
          stroke={1.5}
          style={{ color: "var(--mantine-color-dimmed)" }}
        />
      }
      classNames={{
        separator: "mx-1",
        breadcrumb: "text-sm pb-0.5",
      }}
      style={{ color: "var(--mantine-color-text)" }}
    >
      {segments.map((segment, index) =>
        segment.path ? (
          <Link
            key={index}
            to={segment.path}
            className="max-w-[200px] truncate no-underline transition-colors hover:underline hover:text-[var(--mantine-primary-color-filled)]"
            style={{ color: "var(--mantine-color-dimmed)" }}
          >
            {segment.label}
          </Link>
        ) : (
          <span
            key={index}
            className="max-w-[200px] truncate font-semibold"
            style={{ color: "var(--mantine-color-text)" }}
          >
            {segment.label}
          </span>
        ),
      )}
    </MantineBreadcrumbs>
  );
};
