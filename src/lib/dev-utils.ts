import { fetchExtensions } from "./api/extensions";
import type { ManagedExtension } from "./api/extensions";
import { logger } from "./logger";

/**
 * Cache for extension manifests to avoid repeated API calls
 */
const extensionCache = new Map<string, ManagedExtension>();

/**
 * Fetch extension metadata by ID
 */
export async function getExtensionById(
  extensionId: string,
): Promise<ManagedExtension | null> {
  // Check cache first
  if (extensionCache.has(extensionId)) {
    return extensionCache.get(extensionId)!;
  }

  try {
    const extensions = await fetchExtensions();

    // Cache all extensions
    extensions.forEach((ext) => {
      extensionCache.set(ext.id, ext);
    });

    return extensionCache.get(extensionId) ?? null;
  } catch (error) {
    logger.warn("Failed to fetch extension metadata", {
      component: "dev-utils",
      action: "get-extension-by-id",
      extensionId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return null;
  }
}

/**
 * Build a URL to the manga page on the extension's source website
 *
 * This attempts to construct the source URL intelligently:
 * 1. Use manga.links if provided by extension
 * 2. Construct from extension baseUrl + slug
 *
 * Note: Due to slug sanitization, this may not always match the exact URL
 */
export async function buildExtensionSourceUrl(
  extensionId: string,
  mangaSlug: string | undefined,
  mangaLinks?: Record<string, string>,
): Promise<string | null> {
  // Priority 1: Check if extension provided direct links
  if (mangaLinks) {
    const sourceLink = mangaLinks["source"] || mangaLinks["website"] || mangaLinks["official"];
    if (sourceLink) {
      return sourceLink;
    }
  }

  // Priority 2: Construct from extension baseUrl
  const extension = await getExtensionById(extensionId);
  if (!extension?.manifest?.source?.baseUrl || !mangaSlug) {
    return null;
  }

  const baseUrl = extension.manifest.source.baseUrl.replace(/\/$/, "");

  // Common URL patterns for manga sites
  // This is a best-effort approach - may need adjustment per extension
  return `${baseUrl}/manga/${mangaSlug}`;
}

/**
 * Build a URL to a chapter on the extension's source website
 */
export async function buildChapterSourceUrl(
  extensionId: string,
  mangaSlug: string | undefined,
  chapterExternalUrl?: string,
): Promise<string | null> {
  // If chapter has externalUrl, use it directly
  if (chapterExternalUrl) {
    return chapterExternalUrl;
  }

  // Otherwise, we can't reliably construct chapter URLs
  // since we don't have the chapter slug/ID from the source
  return null;
}

/**
 * Format developer info for display
 */
export interface DevInfoItem {
  label: string;
  value: string;
  copyable: boolean;
  clickable?: boolean;
  url?: string;
}

export function formatDevInfo(data: Record<string, unknown>): DevInfoItem[] {
  const items: DevInfoItem[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;

    const stringValue = String(value);
    const isUrl = stringValue.startsWith("http://") || stringValue.startsWith("https://");

    items.push({
      label: key,
      value: stringValue,
      copyable: true,
      clickable: isUrl,
      url: isUrl ? stringValue : undefined,
    });
  }

  return items;
}

/**
 * Format cache metadata for display
 */
export function formatCacheInfo(cachedCover?: {
  dataUrl: string;
  sourceUrl: string;
  updatedAt: string;
  expiresAt?: string;
  mimeType?: string;
  bytes?: number;
}): DevInfoItem[] {
  if (!cachedCover) {
    return [
      {
        label: "Cache Status",
        value: "Not cached",
        copyable: false,
      },
    ];
  }

  const items: DevInfoItem[] = [
    {
      label: "Cache Status",
      value: "Cached",
      copyable: false,
    },
    {
      label: "Source URL",
      value: cachedCover.sourceUrl,
      copyable: true,
      clickable: true,
      url: cachedCover.sourceUrl,
    },
    {
      label: "Updated At",
      value: new Date(cachedCover.updatedAt).toLocaleString(),
      copyable: false,
    },
  ];

  if (cachedCover.expiresAt) {
    items.push({
      label: "Expires At",
      value: new Date(cachedCover.expiresAt).toLocaleString(),
      copyable: false,
    });
  }

  if (cachedCover.mimeType) {
    items.push({
      label: "MIME Type",
      value: cachedCover.mimeType,
      copyable: false,
    });
  }

  if (cachedCover.bytes) {
    const kb = (cachedCover.bytes / 1024).toFixed(2);
    items.push({
      label: "Size",
      value: `${kb} KB`,
      copyable: false,
    });
  }

  return items;
}

/**
 * Clear extension cache (useful after updates)
 */
export function clearExtensionCache(): void {
  extensionCache.clear();
}
