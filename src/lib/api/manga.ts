import { ApiError, request } from "./client";
import { logger } from "../logger";
import type { CachedCoverPayload } from "./shared";

const DATA_URL_SCHEME_PATTERN = /^(?:data|blob):/i;
const MAX_ATTEMPTED_URL_LENGTH = 4096;

function sanitizeAttemptedUrlList(urls: string[] = []): string[] {
  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const raw of urls) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (DATA_URL_SCHEME_PATTERN.test(trimmed)) continue;

    const normalized =
      trimmed.length > MAX_ATTEMPTED_URL_LENGTH
        ? trimmed.slice(0, MAX_ATTEMPTED_URL_LENGTH)
        : trimmed;

    if (seen.has(normalized)) continue;
    seen.add(normalized);
    sanitized.push(normalized);
  }

  return sanitized;
}

export interface ChapterSummary {
  id: string;
  title?: string;
  number?: string;
  volume?: string;
  publishedAt?: string;
  languageCode?: string;
  externalUrl?: string;
  scanlators?: string[];
}

export interface MangaDetails {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  coverUrl?: string;
  coverUrls?: string[];
  cachedCover?: CachedCoverPayload;
  authors?: string[];
  artists?: string[];
  chapters?: ChapterSummary[];
  genres?: string[];
  tags?: string[];
  rating?: number;
  year?: number;
  links?: Record<string, string>;
  status?: string;
  demographic?: string;
  altTitles?: string[];
}

export interface MangaDetailsResponse {
  details: MangaDetails;
  chaptersFetched: number;
  extensionId?: string;
}

export interface CoverReportPayload {
  mangaId: string;
  extensionId?: string;
  url: string;
  status: "success" | "failure";
  attemptedUrls?: string[];
}

function looksLikeSlug(identifier: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identifier);
}

export async function fetchMangaBySlug(
  slug: string,
  extensionId?: string,
): Promise<MangaDetailsResponse> {
  const params = new URLSearchParams({ includeChapters: "true" });
  if (extensionId) {
    params.set("extensionId", extensionId);
  }

  return request<MangaDetailsResponse>(
    `/manga/by-slug/${encodeURIComponent(slug)}?${params.toString()}`,
  );
}

export async function fetchMangaDetails(
  identifier: string,
  extensionId?: string,
): Promise<MangaDetailsResponse> {
  const params = new URLSearchParams({ includeChapters: "true" });
  if (extensionId) {
    params.set("extensionId", extensionId);
  }

  if (looksLikeSlug(identifier)) {
    try {
      return await fetchMangaBySlug(identifier, extensionId);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
      // Fall back to ID lookup if slug lookup failed.
    }
  }

  return request<MangaDetailsResponse>(
    `/manga/${encodeURIComponent(identifier)}?${params.toString()}`,
  );
}

export async function refreshMangaCache(
  identifier: string,
  extensionId?: string,
): Promise<MangaDetailsResponse> {
  const params = new URLSearchParams();
  if (extensionId) {
    params.set("extensionId", extensionId);
  }

  return request<MangaDetailsResponse>(
    `/manga/${encodeURIComponent(identifier)}/refresh?${params.toString()}`,
    { method: "POST" },
  );
}

export async function reportMangaCoverResult(
  payload: CoverReportPayload,
): Promise<void> {
  const originalAttempted = payload.attemptedUrls ?? [];
  let attemptedUrls = sanitizeAttemptedUrlList(originalAttempted);

  if (
    process.env.NODE_ENV !== "production" &&
    originalAttempted.length > 0 &&
    attemptedUrls.length < originalAttempted.length
  ) {
    logger.debug("Filtered attempted cover URLs for payload.", {
      component: "api.manga",
      action: "filter-cover-urls",
      originalCount: originalAttempted.length,
      retainedCount: attemptedUrls.length,
      droppedCount: originalAttempted.length - attemptedUrls.length,
    });
  }

  let body = {
    url: payload.url,
    status: payload.status,
    attemptedUrls,
    extensionId: payload.extensionId,
  };

  let bodyStr = JSON.stringify(body);
  let iterations = 0;

  while (
    bodyStr.length > 90000 &&
    attemptedUrls.length > 1 &&
    iterations < 20
  ) {
    iterations++;
    const previousLength = attemptedUrls.length;
    attemptedUrls = attemptedUrls.slice(
      0,
      Math.max(1, Math.floor(attemptedUrls.length * 0.5)),
    );
    body = {
      url: payload.url,
      status: payload.status,
      attemptedUrls,
      extensionId: payload.extensionId,
    };
    bodyStr = JSON.stringify(body);

    if (process.env.NODE_ENV !== "production") {
      logger.debug("Trimming oversized cover report payload.", {
        component: "api.manga",
        action: "trim-cover-payload",
        iteration: iterations,
        previousLength,
        nextLength: attemptedUrls.length,
        payloadSize: bodyStr.length,
      });
    }
  }

  if (process.env.NODE_ENV !== "production") {
    logger.debug("Submitting cover report payload.", {
      component: "api.manga",
      action: "submit-cover-report",
      payloadSize: bodyStr.length,
      urlCount: body.attemptedUrls.length,
      originalCount: originalAttempted.length,
    });

    if (bodyStr.length > 100000) {
      logger.error("Cover report payload exceeds size limit.", {
        component: "api.manga",
        action: "oversized-cover-payload",
        payloadSize: bodyStr.length,
        sampleUrls: body.attemptedUrls.slice(0, 3),
      });
    }
  }

  await request<void>(
    `/manga/${encodeURIComponent(payload.mangaId)}/covers/report`,
    {
      method: "POST",
      body: bodyStr,
    },
  );
}
