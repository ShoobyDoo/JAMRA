"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Image, { type ImageProps } from "next/image";
import { refreshMangaCache, reportMangaCoverResult } from "@/lib/api";
import { resolveImageSource } from "@/lib/image-proxy";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings";
import { logger } from "@/lib/logger";
import { COVER_REPORT_LIMITS } from "@/lib/constants";

const WORKING_URL_CACHE_KEY = "jamra_cover_urls_v2";

interface WorkingUrlRecord {
  url: string;
  storedAt: number;
}

type WorkingUrlCache = Record<string, WorkingUrlRecord>;

function makeCoverKey(mangaId: string, extensionId?: string): string {
  return extensionId ? `${extensionId}::${mangaId}` : mangaId;
}

function readWorkingUrlCache(): WorkingUrlCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(WORKING_URL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WorkingUrlCache;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeWorkingUrlCache(cache: WorkingUrlCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKING_URL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors (quota, private mode, etc.)
  }
}

function getWorkingUrlFromCache(
  mangaId: string,
  extensionId: string | undefined,
  ttlMs: number,
): string | null {
  if (typeof window === "undefined") return null;
  const cache = readWorkingUrlCache();
  const key = makeCoverKey(mangaId, extensionId);
  const record = cache[key];
  if (!record) return null;

  if (Date.now() - record.storedAt > ttlMs) {
    delete cache[key];
    writeWorkingUrlCache(cache);
    return null;
  }

  return record.url;
}

function setWorkingUrlInCache(
  mangaId: string,
  extensionId: string | undefined,
  url: string,
): void {
  if (typeof window === "undefined") return;
  const cache = readWorkingUrlCache();
  cache[makeCoverKey(mangaId, extensionId)] = {
    url,
    storedAt: Date.now(),
  };
  writeWorkingUrlCache(cache);
}

function clearWorkingUrlInCache(mangaId: string, extensionId?: string): void {
  if (typeof window === "undefined") return;
  const cache = readWorkingUrlCache();
  const key = makeCoverKey(mangaId, extensionId);
  if (cache[key]) {
    delete cache[key];
    writeWorkingUrlCache(cache);
  }
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    ordered.push(url);
  }
  return ordered;
}

function mergeRefreshedUrls(existing: string[], refreshed: string[]): string[] {
  if (refreshed.length === 0) return existing;
  const merged = dedupeUrls([...refreshed, ...existing]);

  // Dynamically limit URLs based on estimated payload size
  const maxPayloadBytes = COVER_REPORT_LIMITS.MERGED_MAX_BYTES;

  // Estimate JSON payload size: URLs + JSON overhead
  let estimatedSize = 0;
  const limitedUrls: string[] = [];

  for (const url of merged) {
    // Estimate JSON size: URL string + quotes + comma + some overhead
    const urlSize =
      url.length * 2 + COVER_REPORT_LIMITS.MAX_URL_OVERHEAD; // 2 bytes per char (UTF-16) + JSON overhead

    if (estimatedSize + urlSize > maxPayloadBytes) {
      break;
    }

    limitedUrls.push(url);
    estimatedSize += urlSize;
  }

  // Always keep at least 10 URLs for functionality, even if it might exceed limit
  return limitedUrls.length >= COVER_REPORT_LIMITS.MIN_URLS
    ? limitedUrls
    : merged.slice(0, COVER_REPORT_LIMITS.MIN_URLS);
}

function isDataLikeUrl(value: string): boolean {
  return value.startsWith("data:") || value.startsWith("blob:");
}

function limitUrlsForPayload(urls: string[]): string[] {
  const sanitized = urls.filter((url) => !isDataLikeUrl(url));
  if (sanitized.length === 0) {
    if (process.env.NODE_ENV !== "production" && urls.length > 0) {
      logger.debug("Dropping data/blob URLs from auto-refresh payload", {
        component: "AutoRefreshImage",
        action: "sanitize-urls",
        dropped: urls.length,
      });
    }
    return [];
  }

  const maxPayloadBytes = COVER_REPORT_LIMITS.MAX_PAYLOAD_BYTES;
  let estimatedSize = COVER_REPORT_LIMITS.BASE_JSON_OVERHEAD;

  const limitedUrls: string[] = [];
  for (const url of sanitized) {
    const urlSize =
      url.length * 2 + COVER_REPORT_LIMITS.MAX_URL_OVERHEAD; // UTF-16 + JSON overhead
    if (estimatedSize + urlSize > maxPayloadBytes) break;

    limitedUrls.push(url);
    estimatedSize += urlSize;
  }

  // If we couldn't fit even 5 URLs, take them one by one until we hit a reasonable limit
  let result = limitedUrls;
  if (limitedUrls.length < COVER_REPORT_LIMITS.FALLBACK_MIN_URLS) {
    result = [];
    let size = COVER_REPORT_LIMITS.BASE_JSON_OVERHEAD;
    for (
      let i = 0;
      i < Math.min(COVER_REPORT_LIMITS.FALLBACK_MIN_URLS, sanitized.length);
      i++
    ) {
      const url = sanitized[i];
      const urlSize =
        url.length * 2 + COVER_REPORT_LIMITS.MAX_URL_OVERHEAD;
      if (size + urlSize > COVER_REPORT_LIMITS.FALLBACK_MAX_BYTES) break;
      result.push(url);
      size += urlSize;
    }
    // Ensure at least 1 URL for functionality
    if (result.length === 0 && urls.length > 0) {
      result = [urls[0]];
    }
  }

  // Debug logging
  return result;
}

interface ReportPayload {
  mangaId: string;
  extensionId?: string;
  url: string;
  status: "success" | "failure";
  attemptedUrls: string[];
}

async function reportCoverResult(payload: ReportPayload) {
  try {
    await reportMangaCoverResult(payload);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      logger.warn("Failed to report cover result", {
        component: "AutoRefreshImage",
        action: "report-cover-result",
        mangaId: payload.mangaId,
        extensionId: payload.extensionId,
        status: payload.status,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

export interface AutoRefreshImageProps
  extends Omit<ImageProps, "onError" | "onLoad" | "src"> {
  /**
   * Highest priority source — can be a remote URL or cached data URL.
   */
  src: string;
  /**
   * Additional sources to try in order if the primary fails.
   */
  fallbackUrls?: string[];
  /**
   * Identifier used for caching/refresh.
   */
  mangaId?: string;
  /**
   * Extension identifier to disambiguate cache keys.
   */
  extensionId?: string;
  /**
   * Maximum number of API refresh attempts when all URLs fail.
   */
  maxRetries?: number;
  /**
   * Callback fired when a cache refresh is triggered.
   */
  onCacheRefresh?: () => void;
  /**
   * Callback fired after the image successfully loads.
   */
  onLoadComplete?: () => void;
}

export function AutoRefreshImage({
  mangaId,
  extensionId,
  maxRetries = 1,
  fallbackUrls = [],
  onCacheRefresh,
  onLoadComplete,
  src,
  alt,
  ...imageProps
}: AutoRefreshImageProps) {
  const imageCacheSettings = useSettingsStore((state) => state.imageCache);
  const workingUrlTtlMs = useMemo(
    () =>
      Math.max(1, imageCacheSettings.workingUrlTtlDays) * 24 * 60 * 60 * 1000,
    [imageCacheSettings.workingUrlTtlDays],
  );
  const workingCacheEnabled = imageCacheSettings.enabled;

  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNoCover, setShowNoCover] = useState(false);

  const fallbackIndexRef = useRef(0);
  const retryCountRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const allUrlsRef = useRef<string[]>([]);
  const reportedFailuresRef = useRef(new Set<string>());
  const reportedSuccessRef = useRef(false);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const serializedFallbacks = useMemo(
    () => JSON.stringify(fallbackUrls ?? []),
    [fallbackUrls],
  );

  const { prioritizedUrls, urlsSignature } = useMemo(() => {
    let parsed: string[] = [];
    try {
      parsed = JSON.parse(serializedFallbacks) as string[];
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        logger.warn("Failed to parse fallback URL signature", {
          component: "AutoRefreshImage",
          action: "parse-fallbacks",
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    const combined = dedupeUrls([src, ...parsed]);
    return {
      prioritizedUrls: combined,
      urlsSignature: combined.join("|"),
    };
  }, [serializedFallbacks, src]);

  useEffect(() => {
    reportedSuccessRef.current = false;
    reportedFailuresRef.current.clear();
    retryCountRef.current = 0;
    isRefreshingRef.current = false;
    setShowNoCover(false);

    if (prioritizedUrls.length === 0) {
      allUrlsRef.current = [];
      setCurrentSrc(null);
      setIsLoading(false);
      setShowNoCover(true);
      return;
    }

    let urls = prioritizedUrls;
    if (mangaId && workingCacheEnabled) {
      const cached = getWorkingUrlFromCache(
        mangaId,
        extensionId,
        workingUrlTtlMs,
      );
      if (cached) {
        if (!urls.includes(cached)) {
          urls = [cached, ...urls];
        }
        fallbackIndexRef.current = urls.indexOf(cached);
      } else {
        fallbackIndexRef.current = 0;
      }
    } else {
      fallbackIndexRef.current = 0;
    }

    allUrlsRef.current = urls;

    const initial = urls[fallbackIndexRef.current] ?? null;
    setCurrentSrc(initial);
    setIsLoading(initial ? !isDataLikeUrl(initial) : false);
    if (!initial) {
      setShowNoCover(true);
    }
  }, [
    prioritizedUrls,
    urlsSignature,
    mangaId,
    extensionId,
    workingCacheEnabled,
    workingUrlTtlMs,
  ]);

  const handleSuccess = useCallback(() => {
    if (unmountedRef.current) return;
    if (!currentSrc) return;

    setIsLoading(false);
    setShowNoCover(false);

    if (mangaId && !isDataLikeUrl(currentSrc) && workingCacheEnabled) {
      setWorkingUrlInCache(mangaId, extensionId, currentSrc);
    }

    if (mangaId && !reportedSuccessRef.current && !isDataLikeUrl(currentSrc)) {
      reportedSuccessRef.current = true;
      void reportCoverResult({
        mangaId,
        extensionId,
        url: currentSrc,
        status: "success",
        attemptedUrls: limitUrlsForPayload([...allUrlsRef.current]),
      });
    }

    onLoadComplete?.();
  }, [currentSrc, extensionId, mangaId, onLoadComplete, workingCacheEnabled]);

  const handleError = useCallback(async () => {
    if (unmountedRef.current) return;

    const failedUrl = currentSrc;
    if (
      failedUrl &&
      mangaId &&
      !isDataLikeUrl(failedUrl) &&
      workingCacheEnabled
    ) {
      const cached = getWorkingUrlFromCache(
        mangaId,
        extensionId,
        workingUrlTtlMs,
      );
      if (cached === failedUrl) {
        clearWorkingUrlInCache(mangaId, extensionId);
      }
    }

    if (
      failedUrl &&
      mangaId &&
      !isDataLikeUrl(failedUrl) &&
      !reportedFailuresRef.current.has(failedUrl)
    ) {
      reportedFailuresRef.current.add(failedUrl);
      void reportCoverResult({
        mangaId,
        extensionId,
        url: failedUrl,
        status: "failure",
        attemptedUrls: limitUrlsForPayload([...allUrlsRef.current]),
      });
    }

    const allUrls = allUrlsRef.current;
    const nextIndex = fallbackIndexRef.current + 1;
    if (nextIndex < allUrls.length) {
      fallbackIndexRef.current = nextIndex;
      reportedSuccessRef.current = false;
      const nextUrl = allUrls[nextIndex];
      setCurrentSrc(nextUrl);
      setIsLoading(nextUrl ? !isDataLikeUrl(nextUrl) : false);
      return;
    }

    if (
      mangaId &&
      retryCountRef.current < maxRetries &&
      !isRefreshingRef.current
    ) {
      isRefreshingRef.current = true;
      retryCountRef.current += 1;
      setIsLoading(true);

      try {
        onCacheRefresh?.();
        const response = await refreshMangaCache(mangaId, extensionId);
        const details = response.details;
        const refreshedUrls = dedupeUrls([
          ...(details?.coverUrls ?? []),
          ...(details?.coverUrl ? [details.coverUrl] : []),
          // Allow cached cover data to act as first class source if present.
          ...(details?.cachedCover?.dataUrl
            ? [details.cachedCover.dataUrl]
            : []),
        ]);

        if (refreshedUrls.length > 0) {
          const merged = mergeRefreshedUrls(allUrls, refreshedUrls);
          allUrlsRef.current = merged;
          fallbackIndexRef.current = 0;
          reportedSuccessRef.current = false;
          const nextUrl = merged[0];
          setCurrentSrc(nextUrl);
          setIsLoading(nextUrl ? !isDataLikeUrl(nextUrl) : false);
          setShowNoCover(false);
          return;
        }
      } catch (error) {
        logger.error("Cover cache refresh failed", {
          component: "AutoRefreshImage",
          action: "refresh-cache",
          mangaId,
          extensionId,
          retryCount: retryCountRef.current,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      } finally {
        isRefreshingRef.current = false;
      }
    }

    setIsLoading(false);
    setShowNoCover(true);
  }, [
    currentSrc,
    extensionId,
    maxRetries,
    mangaId,
    onCacheRefresh,
    workingCacheEnabled,
    workingUrlTtlMs,
  ]);

  const memoizedSrc = useMemo(
    () => (currentSrc ? resolveImageSource(currentSrc) : ""),
    [currentSrc],
  );

  if (showNoCover) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground/80",
          imageProps.className,
        )}
        style={{
          width: imageProps.width,
          height: imageProps.height,
          ...imageProps.style,
        }}
      >
        <span className="text-sm font-medium">No Cover</span>
      </div>
    );
  }

  if (!currentSrc) {
    return null;
  }

  return (
    <>
      {isLoading && imageProps.fill && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-muted/50 backdrop-blur-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/70" />
        </div>
      )}
      <Image
        {...imageProps}
        src={memoizedSrc}
        alt={alt}
        onLoad={handleSuccess}
        onError={handleError}
        loading={
          imageProps.priority ? undefined : (imageProps.loading ?? "lazy")
        }
        className={cn(
          "will-change-transform transition-transform duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          imageProps.className,
        )}
      />
    </>
  );
}
