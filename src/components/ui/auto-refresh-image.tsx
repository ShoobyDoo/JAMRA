"use client";

import { useState, useCallback, useRef } from "react";
import Image, { type ImageProps } from "next/image";
import { refreshMangaCache } from "@/lib/api";

export interface AutoRefreshImageProps extends Omit<ImageProps, "onError"> {
  /**
   * Manga ID or slug to refresh cache for when image fails to load
   */
  mangaId?: string;
  /**
   * Extension ID for the manga
   */
  extensionId?: string;
  /**
   * Maximum number of retry attempts (default: 1)
   */
  maxRetries?: number;
  /**
   * Custom fallback image to show on final error
   */
  fallbackSrc?: string;
  /**
   * Callback when cache refresh is triggered
   */
  onCacheRefresh?: () => void;
}

/**
 * Smart Image component that automatically refreshes manga cache when images fail to load.
 *
 * When an image fails to load (404, invalid image, CORS error, etc.), this component:
 * 1. Calls the API to refresh the manga's cached data from the extension
 * 2. Retries loading the image with the updated URL
 * 3. Falls back to a placeholder if refresh fails
 *
 * This gracefully handles stale cache and broken image URLs without manual intervention.
 */
export function AutoRefreshImage({
  mangaId,
  extensionId,
  maxRetries = 1,
  fallbackSrc,
  onCacheRefresh,
  src,
  alt,
  ...imageProps
}: AutoRefreshImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  const retryCountRef = useRef(0);
  const isRefreshingRef = useRef(false);

  const handleError = useCallback(async () => {
    // Don't retry if we've exceeded max retries or if already refreshing
    if (retryCountRef.current >= maxRetries || isRefreshingRef.current) {
      setHasError(true);
      if (fallbackSrc) {
        setCurrentSrc(fallbackSrc);
      }
      return;
    }

    // Only attempt cache refresh if we have the necessary identifiers
    if (!mangaId) {
      setHasError(true);
      if (fallbackSrc) {
        setCurrentSrc(fallbackSrc);
      }
      return;
    }

    isRefreshingRef.current = true;
    retryCountRef.current++;

    try {
      console.log(`[AutoRefreshImage] Image failed to load, refreshing cache for manga: ${mangaId}`);

      // Notify parent component
      onCacheRefresh?.();

      // Refresh the manga cache from the extension
      const response = await refreshMangaCache(mangaId, extensionId);

      // Update the image source with the refreshed data
      if (response.details?.coverUrl) {
        console.log(`[AutoRefreshImage] Cache refreshed, new URL: ${response.details.coverUrl}`);
        setCurrentSrc(response.details.coverUrl);
        setHasError(false);
      } else {
        console.warn(`[AutoRefreshImage] Cache refreshed but no cover URL found`);
        setHasError(true);
        if (fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }
    } catch (error) {
      console.error(`[AutoRefreshImage] Failed to refresh cache for manga ${mangaId}:`, error);
      setHasError(true);
      if (fallbackSrc) {
        setCurrentSrc(fallbackSrc);
      }
    } finally {
      isRefreshingRef.current = false;
    }
  }, [mangaId, extensionId, maxRetries, fallbackSrc, onCacheRefresh]);

  // Reset state when src prop changes
  if (src !== currentSrc && !isRefreshingRef.current && retryCountRef.current === 0) {
    setCurrentSrc(src);
    setHasError(false);
  }

  return (
    <Image
      {...imageProps}
      src={currentSrc}
      alt={alt}
      onError={handleError}
      className={imageProps.className}
    />
  );
}
