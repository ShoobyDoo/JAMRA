import type { ExtensionManifest } from "@jamra/extension-sdk";
import type {
  ExtensionArtifactSignature,
  ExtensionRegistryPublisher,
  ExtensionRegistryVersion,
} from "@jamra/extension-registry";
import { API_CONFIG } from "./constants";
import { logger } from "./logger";

const API_BASE =
  process.env.NEXT_PUBLIC_JAMRA_API_URL ??
  process.env.JAMRA_API_URL ??
  `${API_CONFIG.DEFAULT_URL}/api`;

function sanitizeErrorDetail(detail?: string | null): string | undefined {
  if (!detail) return undefined;
  const trimmed = detail.trim();
  if (!trimmed) return undefined;
  const withoutTags = trimmed.includes("<")
    ? trimmed
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : trimmed;
  return withoutTags.length > 0 ? withoutTags : undefined;
}

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

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiRequestOptions extends RequestInit {
  allowStatuses?: number[];
}

async function request<T>(path: string, init: ApiRequestOptions = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const { allowStatuses, ...fetchInit } = init;
  const method = fetchInit.method || "GET";
  const startTime = Date.now();

  // Log the outgoing request
  logger.apiCall(url, method, {
    component: 'API',
    action: 'request',
    requestSize: fetchInit?.body ? JSON.stringify(fetchInit.body).length : 0,
  });

  try {
    const response = await fetch(url, {
      ...fetchInit,
      headers: {
        accept: "application/json",
        ...(fetchInit?.body ? { "content-type": "application/json" } : {}),
        ...(fetchInit?.headers ?? {}),
      },
      cache: "no-store",
    });

    const duration = Date.now() - startTime;
    const responseSize = Number(response.headers.get("content-length")) || 0;
    const isAllowedStatus =
      !response.ok && allowStatuses?.includes(response.status);

    if (isAllowedStatus) {
      logger.info(
        `API ${method} ${url} returned allowed status ${response.status}`,
        {
          component: "API",
          action: "allowed-status",
          url,
          method,
          statusCode: response.status,
          duration,
          responseSize,
        },
      );
    } else {
      // Log the response
      logger.apiResponse(url, method, response.status, duration, {
        component: "API",
        action: "response",
        responseSize,
      });
    }

    if (!response.ok) {
      if (isAllowedStatus) {
        return undefined as T;
      }

      const detailText = await response.text().catch(() => undefined);
      const cleanedDetail = sanitizeErrorDetail(detailText);

      // Try to extract user-friendly error message from JSON response
      let userMessage = cleanedDetail || response.statusText;
      if (cleanedDetail) {
        try {
          const parsed = JSON.parse(detailText || '{}');
          // Extract the most specific error message available
          if (parsed.detail && typeof parsed.detail === 'string') {
            userMessage = parsed.detail;
          } else if (parsed.error && typeof parsed.error === 'string') {
            userMessage = parsed.error;
          } else if (parsed.message && typeof parsed.message === 'string') {
            userMessage = parsed.message;
          }
        } catch {
          // Not JSON or couldn't parse, use cleaned detail
        }
      }

      logger.error(`API request failed: ${response.status} ${response.statusText}`, {
        component: 'API',
        action: 'error',
        url,
        method,
        statusCode: response.status,
        duration,
        error: new Error(userMessage),
      });

      throw new ApiError(
        userMessage,
        response.status,
        response.statusText,
        cleanedDetail,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const responseData = (await response.json()) as T;

    // Log successful data retrieval for debugging
    logger.debug(`API response data received`, {
      component: 'API',
      action: 'data-received',
      url,
      method,
      dataSize: JSON.stringify(responseData).length,
    });

    return responseData;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (
      error instanceof Error &&
      ("name" in error && error.name === "AbortError")
    ) {
      logger.debug(`API request aborted: ${method} ${url}`, {
        component: "API",
        action: "abort",
        url,
        method,
        duration,
      });
      throw error;
    }

    if (error instanceof ApiError) {
      logger.apiError(url, method, error, duration, {
        component: 'API',
        action: 'api-error',
      });
    } else {
      logger.error(`Network or parsing error`, {
        component: 'API',
        action: 'network-error',
        url,
        method,
        duration,
        error: error as Error,
      });
    }

    throw error;
  }
}

export interface CachedCoverPayload {
  dataUrl: string;
  sourceUrl: string;
  updatedAt: string;
  expiresAt?: string;
  mimeType?: string;
  bytes?: number;
}

export interface CatalogueItem {
  id: string;
  slug?: string;
  title: string;
  altTitles?: string[];
  coverUrl?: string;
  coverUrls?: string[];
  cachedCover?: CachedCoverPayload;
  description?: string;
  status?: string;
  tags?: string[];
  demographic?: string;
  languageCode?: string;
  updatedAt?: string;
}

export type MangaSummary = CatalogueItem;

export interface CataloguePage {
  page: number;
  hasMore: boolean;
  items: CatalogueItem[];
  extensionId?: string;
}

export interface CatalogueQueryOptions {
  page?: number;
  query?: string;
  filters?: Record<string, unknown>;
  extensionId?: string;
}

export async function fetchCataloguePage(
  options: CatalogueQueryOptions = {},
): Promise<CataloguePage> {
  const searchParams = new URLSearchParams({
    page: String(options.page ?? 1),
  });

  if (options.query) {
    searchParams.set("query", options.query);
  }

  if (options.filters) {
    searchParams.set("filters", JSON.stringify(options.filters));
  }

  if (options.extensionId) {
    searchParams.set("extensionId", options.extensionId);
  }

  return request<CataloguePage>(`/catalog?${searchParams.toString()}`);
}

export interface MangaDetailsResponse {
  details: MangaDetails;
  chaptersFetched: number;
  extensionId?: string;
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

export interface ChapterSummary {
  id: string;
  title?: string;
  number?: string;
  volume?: string;
  publishedAt?: string;
  languageCode?: string;
  scanlators?: string[];
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

/**
 * Refresh cached manga data from the source extension.
 * Useful when images fail to load or cached data is stale.
 */
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

export interface CoverReportPayload {
  mangaId: string;
  extensionId?: string;
  url: string;
  status: "success" | "failure";
  attemptedUrls?: string[];
}

export async function reportMangaCoverResult(payload: CoverReportPayload): Promise<void> {
  const originalAttempted = payload.attemptedUrls ?? [];
  let attemptedUrls = sanitizeAttemptedUrlList(originalAttempted);

  if (
    process.env.NODE_ENV !== "production" &&
    originalAttempted.length > 0 &&
    attemptedUrls.length < originalAttempted.length
  ) {
    console.log(
      "[API] Filtered attempted cover URLs for payload.",
      {
        original: originalAttempted.length,
        retained: attemptedUrls.length,
        dropped: originalAttempted.length - attemptedUrls.length,
      },
    );
  }

  // Hard failsafe: If payload is too large, aggressively trim URLs
  let body = {
    url: payload.url,
    status: payload.status,
    attemptedUrls,
    extensionId: payload.extensionId,
  };

  let bodyStr = JSON.stringify(body);

  // If still too large, progressively reduce URLs
  let iterations = 0;
  while (bodyStr.length > 90000 && attemptedUrls.length > 1 && iterations < 20) { // 90KB safety margin
    iterations++;
    const oldLength = attemptedUrls.length;
    // More aggressive reduction: cut in half each time
    attemptedUrls = attemptedUrls.slice(0, Math.max(1, Math.floor(attemptedUrls.length * 0.5)));
    body = {
      url: payload.url,
      status: payload.status,
      attemptedUrls,
      extensionId: payload.extensionId,
    };
    bodyStr = JSON.stringify(body);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[API] Failsafe iteration ${iterations}: ${oldLength} -> ${attemptedUrls.length} URLs, payload: ${bodyStr.length} bytes`);
    }
  }

  // Debug logging for payload size
  if (process.env.NODE_ENV !== "production") {
    console.log(`[API] Cover report payload size: ${bodyStr.length} bytes, URLs: ${body.attemptedUrls.length} (original: ${(payload.attemptedUrls ?? []).length})`);
    if (bodyStr.length > 100000) {
      console.error(`[API] PAYLOAD TOO LARGE: ${bodyStr.length} bytes > 100KB limit!`);
      console.log(`[API] Sample URLs:`, body.attemptedUrls.slice(0, 3));
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

export interface CacheSettings {
  enabled: boolean;
  ttlMs: number;
  maxEntries: number;
  fetchTimeoutMs?: number;
}

export interface UpdateCacheSettingsPayload {
  enabled?: boolean;
  ttlMs?: number;
  ttlDays?: number;
  maxEntries?: number;
  fetchTimeoutMs?: number;
}

export async function fetchCacheSettings(): Promise<CacheSettings> {
  const response = await request<{ settings: CacheSettings }>(
    "/system/cache-settings",
  );
  return response.settings;
}

export async function updateCacheSettings(
  payload: UpdateCacheSettingsPayload,
): Promise<CacheSettings> {
  const response = await request<{ settings: CacheSettings }>(
    "/system/cache-settings",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return response.settings;
}

export interface ChapterPagesResponse {
  pages: ChapterPages;
  extensionId?: string;
}

export interface ChapterPagesChunkResponse {
  chunk: ChapterPagesChunk;
  extensionId?: string;
}

export interface ChapterPages {
  chapterId: string;
  mangaId: string;
  pages: Array<{
    index: number;
    url: string;
    width?: number;
    height?: number;
    bytes?: number;
  }>;
}

export async function fetchChapterPages(
  mangaId: string,
  chapterId: string,
  extensionId?: string,
): Promise<ChapterPagesResponse> {
  const params = new URLSearchParams();
  if (extensionId) {
    params.set("extensionId", extensionId);
  }

  const query = params.toString();
  const suffix = query.length > 0 ? `?${query}` : "";

  return request<ChapterPagesResponse>(
    `/manga/${encodeURIComponent(mangaId)}/chapters/${encodeURIComponent(chapterId)}/pages${suffix}`,
  );
}

export interface ChapterPagesChunk {
  chapterId: string;
  mangaId: string;
  chunk: number;
  chunkSize: number;
  totalChunks: number;
  totalPages: number;
  pages: ChapterPages["pages"];
  hasMore: boolean;
}

export async function fetchChapterPagesChunk(
  mangaId: string,
  chapterId: string,
  chunk: number,
  chunkSize: number,
  extensionId?: string,
  options?: {
    signal?: AbortSignal;
  },
): Promise<ChapterPagesChunk> {
  const params = new URLSearchParams({
    size: String(chunkSize),
  });

  if (extensionId) {
    params.set("extensionId", extensionId);
  }

  const query = params.toString();
  const suffix = query.length > 0 ? `?${query}` : "";

  const response = await request<ChapterPagesChunkResponse>(
    `/manga/${encodeURIComponent(mangaId)}/chapters/${encodeURIComponent(chapterId)}/pages/chunk/${chunk}${suffix}`,
    {
      signal: options?.signal,
    },
  );

  return response.chunk;
}
export interface ManagedExtension {
  id: string;
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  icon?: string;
  author: {
    name: string;
    url?: string;
    contact?: string;
  };
  languageCodes: string[];
  capabilities: Record<string, unknown>;
  manifest: ExtensionManifest;
  installedAt: number;
  entryPath?: string;
  enabled: boolean;
  loaded: boolean;
  errors: string[];
  settings?: Record<string, unknown>;
  source?: ManagedExtensionSourceMetadata;
  updateState?: ManagedExtensionUpdateState;
}

export interface ManagedExtensionSourceMetadata {
  registryId?: string;
  manifestUrl?: string;
  downloadUrl?: string;
  checksum?: string;
  signature?: ExtensionArtifactSignature;
  version?: string;
}

export interface ManagedExtensionUpdateDetails {
  version: string;
  downloadUrl: string;
  checksum?: string;
  releaseNotes: string;
  publishedAt?: string;
  manifestUrl?: string;
  minHostVersion?: string;
  minSdkVersion?: string;
  compatibilityNotes?: string;
  signature?: ExtensionArtifactSignature;
  registryId?: string;
}

export interface ManagedExtensionUpdateState {
  latest?: ManagedExtensionUpdateDetails;
  lastCheckedAt?: number;
  acknowledgedVersion?: string;
  acknowledgedAt?: number;
}

export interface ExtensionListOptions {
  search?: string;
  status?: "enabled" | "disabled";
  sort?: "name" | "installedAt" | "author" | "language";
  order?: "asc" | "desc";
}

interface ExtensionListResponse {
  extensions: ManagedExtension[];
}

interface ExtensionEnvelope {
  extension: ManagedExtension | undefined;
}

function buildExtensionSearchParams(
  options: ExtensionListOptions = {},
): string {
  const params = new URLSearchParams();
  if (options.search) params.set("search", options.search);
  if (options.status) params.set("status", options.status);
  if (options.sort) params.set("sort", options.sort);
  if (options.order) params.set("order", options.order);
  return params.toString();
}

export async function fetchExtensions(
  options: ExtensionListOptions = {},
): Promise<ManagedExtension[]> {
  const query = buildExtensionSearchParams(options);
  const suffix = query.length > 0 ? `?${query}` : "";
  const response = await request<ExtensionListResponse>(`/extensions${suffix}`);
  return response.extensions;
}

export interface InstallExtensionSourcePayload {
  registryId: string;
  extensionId: string;
  version?: string;
}

export interface InstallExtensionPayload {
  filePath?: string;
  source?: InstallExtensionSourcePayload;
  enabled?: boolean;
  settings?: Record<string, unknown> | null;
}

export interface MarketplaceRegistrySummary {
  id: string;
  label: string;
  name: string;
  description?: string;
  homepage?: string;
  supportUrl?: string;
  manifestUrl: string;
  generatedAt?: string;
  fetchedAt: number;
  extensionCount: number;
  maintainers: ExtensionRegistryPublisher[];
}

export interface MarketplaceExtensionSummary {
  registryId: string;
  registryLabel: string;
  manifestUrl: string;
  id: string;
  name: string;
  summary: string;
  description?: string;
  homepage?: string;
  repository?: string;
  icon?: string;
  tags: string[];
  categories: string[];
  author: ExtensionRegistryPublisher;
  maintainers: ExtensionRegistryPublisher[];
  versions: ExtensionRegistryVersion[];
  latestVersion?: ExtensionRegistryVersion;
}

export interface MarketplaceData {
  registries: MarketplaceRegistrySummary[];
  extensions: MarketplaceExtensionSummary[];
}

export async function installExtension(
  payload: InstallExtensionPayload,
): Promise<ManagedExtension> {
  if (!payload.filePath && !payload.source) {
    throw new Error(
      "Provide either filePath or source when installing an extension.",
    );
  }

  const response = await request<ExtensionEnvelope>(`/extensions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.extension) {
    throw new Error(
      "Extension installation response did not include extension data.",
    );
  }
  return response.extension;
}

export async function enableExtension(
  id: string,
  settings?: Record<string, unknown> | null,
): Promise<ManagedExtension> {
  const response = await request<ExtensionEnvelope>(
    `/extensions/${encodeURIComponent(id)}/enable`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings }),
    },
  );
  if (!response.extension) {
    throw new Error(`Extension ${id} could not be enabled.`);
  }
  return response.extension;
}

export async function disableExtension(
  id: string,
): Promise<ManagedExtension | undefined> {
  const response = await request<ExtensionEnvelope>(
    `/extensions/${encodeURIComponent(id)}/disable`,
    {
      method: "POST",
    },
  );
  return response.extension;
}

export async function updateExtensionSettings(
  id: string,
  settings: Record<string, unknown> | null,
): Promise<ManagedExtension> {
  const response = await request<ExtensionEnvelope>(
    `/extensions/${encodeURIComponent(id)}/settings`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings }),
    },
  );
  if (!response.extension) {
    throw new Error(`Extension ${id} settings update failed.`);
  }
  return response.extension;
}

export async function uninstallExtension(id: string): Promise<void> {
  await request(`/extensions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

interface MarketplaceResponsePayload {
  registries: Array<{
    id: string;
    label: string;
    name: string;
    description?: string | null;
    homepage?: string | null;
    supportUrl?: string | null;
    manifestUrl: string;
    generatedAt?: string | null;
    fetchedAt: number;
    extensionCount: number;
    maintainers?: ExtensionRegistryPublisher[];
  }>;
  extensions: Array<{
    registryId: string;
    registryLabel: string;
    manifestUrl: string;
    id: string;
    name: string;
    summary: string;
    description?: string | null;
    homepage?: string | null;
    repository?: string | null;
    icon?: string | null;
    tags?: string[];
    categories?: string[];
    author: ExtensionRegistryPublisher;
    maintainers?: ExtensionRegistryPublisher[];
    versions: ExtensionRegistryVersion[];
    latestVersion?: ExtensionRegistryVersion | null;
  }>;
}

export async function fetchExtensionMarketplace(): Promise<MarketplaceData> {
  const payload = await request<MarketplaceResponsePayload>(
    "/extension-marketplace",
  );
  return {
    registries: payload.registries.map((registry) => ({
      id: registry.id,
      label: registry.label,
      name: registry.name,
      description: registry.description ?? undefined,
      homepage: registry.homepage ?? undefined,
      supportUrl: registry.supportUrl ?? undefined,
      manifestUrl: registry.manifestUrl,
      generatedAt: registry.generatedAt ?? undefined,
      fetchedAt: registry.fetchedAt,
      extensionCount: registry.extensionCount,
      maintainers: registry.maintainers ?? [],
    })),
    extensions: payload.extensions.map((extension) => ({
      registryId: extension.registryId,
      registryLabel: extension.registryLabel,
      manifestUrl: extension.manifestUrl,
      id: extension.id,
      name: extension.name,
      summary: extension.summary,
      description: extension.description ?? undefined,
      homepage: extension.homepage ?? undefined,
      repository: extension.repository ?? undefined,
      icon: extension.icon ?? undefined,
      tags: extension.tags ?? [],
      categories: extension.categories ?? [],
      author: extension.author,
      maintainers: extension.maintainers ?? [],
      versions: extension.versions,
      latestVersion: extension.latestVersion ?? undefined,
    })),
  };
}

export async function checkExtensionUpdates(
  id: string,
): Promise<ManagedExtension> {
  const response = await request<ExtensionEnvelope>(
    `/extensions/${encodeURIComponent(id)}/check-updates`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
    },
  );
  if (!response.extension) {
    throw new Error(`Extension ${id} did not return update data.`);
  }
  return response.extension;
}

export async function acknowledgeExtensionUpdate(
  id: string,
  version: string,
): Promise<ManagedExtension> {
  const response = await request<ExtensionEnvelope>(
    `/extensions/${encodeURIComponent(id)}/acknowledge-update`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version }),
    },
  );
  if (!response.extension) {
    throw new Error(`Extension ${id} acknowledgement failed.`);
  }
  return response.extension;
}

// Reading Progress
export interface ReadingProgressData {
  mangaId: string;
  chapterId: string;
  currentPage: number;
  totalPages: number;
  lastReadAt: number;
}

export interface EnrichedReadingProgress extends ReadingProgressData {
  manga: MangaDetails | null;
  error: string | null;
  extensionId?: string;
}

export async function saveReadingProgress(
  mangaId: string,
  chapterId: string,
  currentPage: number,
  totalPages: number
): Promise<void> {
  await request<{ success: boolean }>("/reading-progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mangaId,
      chapterId,
      currentPage,
      totalPages,
      scrollPosition: 0, // Keep for DB compatibility, but always set to 0
    }),
  });
}

export async function getReadingProgress(
  mangaId: string,
  chapterId: string
): Promise<ReadingProgressData | null> {
  const result = await request<ReadingProgressData | undefined>(
    `/reading-progress/${encodeURIComponent(mangaId)}/${encodeURIComponent(chapterId)}`,
    { allowStatuses: [404] }
  );
  return result ?? null;
}

export async function getAllReadingProgress(): Promise<ReadingProgressData[]> {
  return request<ReadingProgressData[]>("/reading-progress");
}

export async function getEnrichedReadingProgress(
  limit?: number,
): Promise<EnrichedReadingProgress[]> {
  const params = new URLSearchParams();
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    params.set("limit", String(Math.floor(limit)));
  }
  const query = params.toString();
  const suffix = query.length > 0 ? `?${query}` : "";
  return request<EnrichedReadingProgress[]>(
    `/reading-progress/enriched${suffix}`,
  );
}

export async function clearChaptersCache(mangaId: string): Promise<void> {
  await request(`/manga/${encodeURIComponent(mangaId)}/chapters`, {
    method: "DELETE",
  });
}

/**
 * DANGER ZONE: Nuclear option to clear all user data
 * (reading progress, cached manga, etc.) but preserves installed extensions.
 *
 * Only available in development mode.
 */
export async function nukeUserData(): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>("/danger/nuke-user-data", {
    method: "POST",
  });
}

// ============================================================================
// Offline Storage API
// ============================================================================

export type DownloadStatus = "queued" | "downloading" | "completed" | "failed" | "paused";

export interface OfflineQueuedDownload {
  id: number;
  extensionId: string;
  mangaId: string;
  mangaSlug: string;
  mangaTitle?: string;
  chapterId?: string;
  chapterNumber?: string;
  chapterTitle?: string;
  status: DownloadStatus;
  priority: number;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
  progressCurrent: number;
  progressTotal: number;
}

export interface OfflineChapterMetadata {
  chapterId: string;
  slug: string;
  number?: string;
  title?: string;
  displayTitle: string;
  volume?: string;
  publishedAt?: string;
  languageCode?: string;
  scanlators?: string[];
  folderName: string;
  totalPages: number;
  downloadedAt: number;
  sizeBytes: number;
}

export interface OfflineMangaMetadata {
  version: 1;
  downloadedAt: number;
  lastUpdatedAt: number;
  mangaId: string;
  slug: string;
  extensionId: string;
  title: string;
  description?: string;
  coverUrl?: string;
  coverPath: string;
  authors?: string[];
  artists?: string[];
  genres?: string[];
  tags?: string[];
  rating?: number;
  year?: number;
  status?: string;
  demographic?: string;
  altTitles?: string[];
  chapters: OfflineChapterMetadata[];
}

interface QueueChapterDownloadResponse {
  queueId: number;
  success: boolean;
}

interface QueueMangaDownloadResponse {
  queueIds: number[];
  success: boolean;
}

interface OfflineChapterStatusResponse {
  isDownloaded: boolean;
}

interface OfflineChaptersResponse {
  chapters: OfflineChapterMetadata[];
}

interface OfflineMangaResponse {
  manga: OfflineMangaMetadata;
}

interface OfflineQueueResponse {
  queue: OfflineQueuedDownload[];
}

export async function queueChapterDownload(
  extensionId: string,
  mangaId: string,
  chapterId: string,
  priority = 0
): Promise<QueueChapterDownloadResponse> {
  return request<QueueChapterDownloadResponse>("/offline/download/chapter", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      extensionId,
      mangaId,
      chapterId,
      priority,
    }),
  });
}

export async function queueMangaDownload(
  extensionId: string,
  mangaId: string,
  options: { chapterIds?: string[]; priority?: number } = {}
): Promise<QueueMangaDownloadResponse> {
  return request<QueueMangaDownloadResponse>("/offline/download/manga", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      extensionId,
      mangaId,
      chapterIds: options.chapterIds,
      priority: options.priority ?? 0,
    }),
  });
}

export async function getOfflineChapterStatus(
  extensionId: string,
  mangaId: string,
  chapterId: string
): Promise<boolean> {
  const params = new URLSearchParams({ extensionId });
  const response = await request<OfflineChapterStatusResponse>(
    `/offline/manga/${encodeURIComponent(mangaId)}/chapters/${encodeURIComponent(chapterId)}/status?${params.toString()}`,
  );
  return response.isDownloaded;
}

export async function getOfflineChapters(
  extensionId: string,
  mangaId: string
): Promise<OfflineChapterMetadata[]> {
  const params = new URLSearchParams({ extensionId });
  const response = await request<OfflineChaptersResponse>(
    `/offline/manga/${encodeURIComponent(mangaId)}/chapters?${params.toString()}`,
  );
  return response.chapters;
}

export async function getOfflineMangaMetadata(
  extensionId: string,
  mangaId: string
): Promise<OfflineMangaMetadata | null> {
  const params = new URLSearchParams({ extensionId });
  const response = await request<OfflineMangaResponse | undefined>(
    `/offline/manga/${encodeURIComponent(mangaId)}?${params.toString()}`,
    { allowStatuses: [404] },
  );
  return response?.manga ?? null;
}

export async function getOfflineQueue(): Promise<OfflineQueuedDownload[]> {
  const response = await request<OfflineQueueResponse>("/offline/queue");
  return response.queue;
}

interface OfflineDownloadProgressResponse {
  progress: {
    queueId: number;
    mangaTitle: string;
    chapterTitle?: string;
    status: DownloadStatus;
    progressCurrent: number;
    progressTotal: number;
    progressPercent: number;
    downloadedBytes: number;
    totalBytes: number;
    speedBytesPerSecond?: number;
    estimatedTimeRemainingMs?: number;
    errorMessage?: string;
  };
}

export async function getOfflineDownloadProgress(
  queueId: number
): Promise<OfflineDownloadProgressResponse["progress"] | null> {
  const response = await request<OfflineDownloadProgressResponse | undefined>(
    `/offline/queue/${encodeURIComponent(String(queueId))}`,
    { allowStatuses: [404] },
  );
  return response?.progress ?? null;
}

export async function cancelOfflineDownload(queueId: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/offline/queue/${encodeURIComponent(String(queueId))}/cancel`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
    },
  );
}

export async function retryOfflineDownload(queueId: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/offline/queue/${encodeURIComponent(String(queueId))}/retry`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
    },
  );
}

export async function retryFrozenDownloads(): Promise<{ success: boolean; retriedCount: number; retriedIds: number[] }> {
  return request<{ success: boolean; retriedCount: number; retriedIds: number[] }>(
    `/offline/queue/retry-frozen`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
    },
  );
}

export async function deleteOfflineChapter(
  extensionId: string,
  mangaId: string,
  chapterId: string
): Promise<void> {
  const params = new URLSearchParams({ extensionId });
  await request(
    `/offline/manga/${encodeURIComponent(mangaId)}/chapters/${encodeURIComponent(chapterId)}?${params.toString()}`,
    { method: "DELETE" },
  );
}

export async function deleteOfflineManga(
  extensionId: string,
  mangaId: string
): Promise<void> {
  const params = new URLSearchParams({ extensionId });
  await request(
    `/offline/manga/${encodeURIComponent(mangaId)}?${params.toString()}`,
    { method: "DELETE" },
  );
}

// ============================================================================
// Download History API
// ============================================================================

export interface OfflineDownloadHistoryItem {
  id: number;
  extensionId: string;
  mangaId: string;
  mangaSlug: string;
  mangaTitle?: string;
  chapterId?: string;
  chapterNumber?: string;
  chapterTitle?: string;
  status: DownloadStatus;
  queuedAt: number;
  startedAt?: number;
  completedAt: number;
  errorMessage?: string;
  progressCurrent: number;
  progressTotal: number;
}

interface OfflineDownloadHistoryResponse {
  history: OfflineDownloadHistoryItem[];
}

export async function getOfflineDownloadHistory(limit?: number): Promise<OfflineDownloadHistoryItem[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }

  const query = params.toString();
  const suffix = query.length > 0 ? `?${query}` : "";

  const response = await request<OfflineDownloadHistoryResponse>(`/offline/history${suffix}`);
  return response.history;
}

export async function deleteOfflineHistoryItem(historyId: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/offline/history/${encodeURIComponent(String(historyId))}`,
    { method: "DELETE" },
  );
}

export async function clearOfflineDownloadHistory(): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/offline/history", {
    method: "DELETE",
  });
}
