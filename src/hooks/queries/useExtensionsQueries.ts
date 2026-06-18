import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import { API_PATHS } from "../../constants/api";
import type {
  ExtensionChaptersResponse,
  ExtensionPagesResponse,
  ExtensionRecord,
  ExtensionSearchResponse,
  ExtensionsListResponse,
  MangaDetailsResponse,
} from "../../types";

type SearchFilters = {
  query: string;
  page?: number;
  [key: string]: string | number | boolean | undefined;
};

const EXTENSION_SEARCH_PAGE_SIZE = 24;

export const extensionKeys = {
  all: ["extensions"] as const,
  list: ["extensions", "list"] as const,
  detail: (extensionId: string) =>
    ["extensions", "detail", extensionId] as const,
  search: (extensionId: string, filters: SearchFilters) =>
    [
      "extensions",
      "search",
      extensionId,
      filters.query,
      filters.page,
    ] as const,
  searchInfinite: (extensionId: string, query: string) =>
    ["extensions", "search-infinite", extensionId, query] as const,
  manga: (extensionId: string, mangaId: string) =>
    ["extensions", "manga", extensionId, mangaId] as const,
  chapters: (extensionId: string, mangaId: string) =>
    ["extensions", "chapters", extensionId, mangaId] as const,
  pages: (extensionId: string, mangaId: string, chapterId: string) =>
    [
      "extensions",
      "pages",
      extensionId,
      mangaId,
      chapterId,
    ] as const,
};

export const useExtensionsList = () => {
  return useQuery({
    queryKey: extensionKeys.list,
    queryFn: () =>
      apiClient.get<ExtensionsListResponse>(API_PATHS.extensions),
  });
};

export const useExtension = (extensionId?: string) => {
  return useQuery({
    queryKey: extensionId
      ? extensionKeys.detail(extensionId)
      : ["extensions", "detail"],
    queryFn: () =>
      apiClient.get<{ extension: ExtensionRecord }>(
        API_PATHS.extension(extensionId!),
      ),
    select: (data) => data.extension,
    enabled: Boolean(extensionId),
  });
};

export const useExtensionSearch = (
  extensionId?: string,
  filters?: SearchFilters,
) => {
  return useQuery({
    queryKey:
      extensionId && filters
        ? extensionKeys.search(extensionId, filters)
        : ["extensions", "search"],
    queryFn: () =>
      apiClient.get<ExtensionSearchResponse>(
        API_PATHS.extensionSearch(extensionId!),
        { params: filters },
      ),
    enabled: Boolean(extensionId && filters !== undefined),
  });
};

export const useExtensionSearchInfinite = (
  extensionId?: string,
  filters?: { query: string },
) => {
  return useInfiniteQuery({
    queryKey: extensionId
      ? extensionKeys.searchInfinite(extensionId, filters?.query ?? "")
      : ["extensions", "search-infinite"],
    queryFn: ({ pageParam }) =>
      apiClient.get<ExtensionSearchResponse>(
        API_PATHS.extensionSearch(extensionId!),
        {
          params: {
            query: filters?.query ?? "",
            page: pageParam,
            count: EXTENSION_SEARCH_PAGE_SIZE,
          },
        },
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    enabled: Boolean(extensionId && filters !== undefined),
  });
};

export const useExtensionManga = (
  extensionId?: string,
  mangaId?: string,
) => {
  return useQuery({
    queryKey:
      extensionId && mangaId
        ? extensionKeys.manga(extensionId, mangaId)
        : ["extensions", "manga"],
    queryFn: () =>
      apiClient.get<MangaDetailsResponse>(
        API_PATHS.extensionManga(extensionId!, mangaId!),
      ),
    enabled: Boolean(extensionId && mangaId),
  });
};

export const useExtensionChapters = (
  extensionId?: string,
  mangaId?: string,
) => {
  return useQuery({
    queryKey:
      extensionId && mangaId
        ? extensionKeys.chapters(extensionId, mangaId)
        : ["extensions", "chapters"],
    queryFn: () =>
      apiClient.get<ExtensionChaptersResponse>(
        API_PATHS.extensionChapters(extensionId!, mangaId!),
      ),
    enabled: Boolean(extensionId && mangaId),
  });
};

export const useExtensionPages = (
  extensionId?: string,
  mangaId?: string,
  chapterId?: string,
) => {
  return useQuery({
    queryKey:
      extensionId && mangaId && chapterId
        ? extensionKeys.pages(extensionId, mangaId, chapterId)
        : ["extensions", "pages"],
    queryFn: () =>
      apiClient.get<ExtensionPagesResponse>(
        API_PATHS.extensionPages(extensionId!, mangaId!, chapterId!),
      ),
    enabled: Boolean(extensionId && mangaId && chapterId),
  });
};

// Aliases for consistency with test naming
export const useExtensionDetails = useExtension;
export const useExtensionMangaDetails = useExtensionManga;
