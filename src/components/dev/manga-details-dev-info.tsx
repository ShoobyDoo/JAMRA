"use client";

import { useEffect, useState } from "react";
import { DevInfoSection } from "./dev-info-section";
import { useDevMode } from "@/hooks/use-dev-mode";
import type { MangaDetails } from "@/lib/api/manga";
import {
  getExtensionById,
  buildExtensionSourceUrl,
  formatCacheInfo,
} from "@/lib/dev-utils";
import type { DevInfoItem } from "@/lib/dev-utils";

interface MangaDetailsDevInfoProps {
  mangaId: string;
  extensionId: string;
  details: MangaDetails;
}

export function MangaDetailsDevInfo({
  mangaId,
  extensionId,
  details,
}: MangaDetailsDevInfoProps) {
  const devMode = useDevMode();
  const [extensionInfo, setExtensionInfo] = useState<{
    name: string;
    version: string;
    baseUrl?: string;
  } | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!devMode) return;

    async function loadExtensionInfo() {
      const ext = await getExtensionById(extensionId);
      if (ext) {
        setExtensionInfo({
          name: ext.name,
          version: ext.version,
          baseUrl: ext.manifest?.source?.baseUrl,
        });
      }

      const url = await buildExtensionSourceUrl(
        extensionId,
        details.slug,
        details.links,
      );
      setSourceUrl(url);
    }

    loadExtensionInfo();
  }, [devMode, extensionId, details.slug, details.links]);

  if (!devMode) return null;

  // Extension Details
  const extensionItems: DevInfoItem[] = [
    {
      label: "Extension ID",
      value: extensionId,
      copyable: true,
    },
  ];

  if (extensionInfo) {
    extensionItems.push(
      {
        label: "Extension Name",
        value: extensionInfo.name,
        copyable: false,
      },
      {
        label: "Extension Version",
        value: extensionInfo.version,
        copyable: false,
      },
    );

    if (extensionInfo.baseUrl) {
      extensionItems.push({
        label: "Source Website",
        value: extensionInfo.baseUrl,
        copyable: true,
        clickable: true,
        url: extensionInfo.baseUrl,
      });
    }
  }

  // Manga IDs
  const mangaIdItems: DevInfoItem[] = [
    {
      label: "JAMRA Manga ID",
      value: mangaId,
      copyable: true,
    },
    {
      label: "Extension Manga ID",
      value: details.id,
      copyable: true,
    },
  ];

  if (details.slug) {
    mangaIdItems.push({
      label: "Manga Slug",
      value: details.slug,
      copyable: true,
    });
  }

  if (sourceUrl) {
    mangaIdItems.push({
      label: "Source Page URL",
      value: sourceUrl,
      copyable: true,
      clickable: true,
      url: sourceUrl,
    });
  } else if (!details.slug) {
    mangaIdItems.push({
      label: "Source Page URL",
      value: "Cannot construct - no slug available",
      copyable: false,
    });
  }

  // Cover Image Debug
  const coverItems: DevInfoItem[] = [];

  if (details.coverUrl) {
    coverItems.push({
      label: "Primary Cover URL",
      value: details.coverUrl,
      copyable: true,
      clickable: true,
      url: details.coverUrl,
    });
  }

  if (details.coverUrls && details.coverUrls.length > 0) {
    details.coverUrls.forEach((url, idx) => {
      coverItems.push({
        label: `Fallback Cover ${idx + 1}`,
        value: url,
        copyable: true,
        clickable: true,
        url: url,
      });
    });
  }

  // Cache Info
  const cacheItems = formatCacheInfo(details.cachedCover);

  const groups = [
    {
      title: "Extension Details",
      items: extensionItems,
      defaultOpen: false,
    },
    {
      title: "Manga IDs & URLs",
      items: mangaIdItems,
      defaultOpen: false,
    },
    {
      title: "Cover Images",
      items: coverItems,
      defaultOpen: false,
    },
    {
      title: "Cache Metadata",
      items: cacheItems,
      defaultOpen: false,
    },
  ];

  return <DevInfoSection groups={groups} />;
}
