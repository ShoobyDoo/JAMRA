import type { ExtensionManifest } from "@jamra/extension-sdk";
import type {
  ExtensionArtifactSignature,
  ExtensionRegistryPublisher,
  ExtensionRegistryVersion,
} from "@jamra/extension-registry";
import { API_CONFIG } from "./constants";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detailText = await response.text().catch(() => undefined);
    const cleanedDetail = sanitizeErrorDetail(detailText);
    throw new ApiError(
      `API request failed: ${response.status} ${response.statusText}${cleanedDetail ? ` - ${cleanedDetail}` : ""}`,
      response.status,
      response.statusText,
      cleanedDetail,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface CatalogueItem {
  id: string;
  title: string;
  altTitles?: string[];
  coverUrl?: string;
  description?: string;
  status?: string;
  tags?: string[];
  demographic?: string;
  languageCode?: string;
  updatedAt?: string;
}

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
  title: string;
  description?: string;
  coverUrl?: string;
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
}

export async function fetchMangaDetails(
  id: string,
  extensionId?: string,
): Promise<MangaDetailsResponse> {
  const params = new URLSearchParams({ includeChapters: "true" });
  if (extensionId) {
    params.set("extensionId", extensionId);
  }

  return request<MangaDetailsResponse>(
    `/manga/${encodeURIComponent(id)}?${params.toString()}`,
  );
}

export interface ChapterPagesResponse {
  pages: ChapterPages;
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
  try {
    return await request<ReadingProgressData>(
      `/reading-progress/${encodeURIComponent(mangaId)}/${encodeURIComponent(chapterId)}`
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getAllReadingProgress(): Promise<ReadingProgressData[]> {
  return request<ReadingProgressData[]>("/reading-progress");
}
