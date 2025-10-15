"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Image, { type ImageProps } from "next/image";
import { refreshMangaCache, reportMangaCoverResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings";

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
  return dedupeUrls([...refreshed, ...existing]);
}

function isDataLikeUrl(value: string): boolean {
  return value.startsWith("data:") || value.startsWith("blob:");
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
      console.warn("[AutoRefreshImage] Failed to report cover result", error);
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
    () => Math.max(1, imageCacheSettings.workingUrlTtlDays) * 24 * 60 * 60 * 1000,
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
        console.warn("Failed to parse fallback URLs signature", error);
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
      const cached = getWorkingUrlFromCache(mangaId, extensionId, workingUrlTtlMs);
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

    if (
      mangaId &&
      !reportedSuccessRef.current &&
      !isDataLikeUrl(currentSrc)
    ) {
      reportedSuccessRef.current = true;
      void reportCoverResult({
        mangaId,
        extensionId,
        url: currentSrc,
        status: "success",
        attemptedUrls: [...allUrlsRef.current],
      });
    }

    onLoadComplete?.();
  }, [
    currentSrc,
    extensionId,
    mangaId,
    onLoadComplete,
    workingCacheEnabled,
  ]);

  const handleError = useCallback(async () => {
    if (unmountedRef.current) return;

    const failedUrl = currentSrc;
    if (
      failedUrl &&
      mangaId &&
      !isDataLikeUrl(failedUrl) &&
      workingCacheEnabled
    ) {
      const cached = getWorkingUrlFromCache(mangaId, extensionId, workingUrlTtlMs);
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
        attemptedUrls: [...allUrlsRef.current],
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
          ...(details?.cachedCover?.dataUrl ? [details.cachedCover.dataUrl] : []),
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
        console.error("[AutoRefreshImage] Cache refresh failed", error);
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
        src={currentSrc}
        alt={alt}
        onLoad={handleSuccess}
        onError={handleError}
        loading={imageProps.loading ?? "lazy"}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          imageProps.className,
        )}
      />
    </>
  );
}
