/**
 * Catalog Controller
 *
 * Handles catalog browsing and filter endpoints
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import type { ExtensionFilters } from "@jamra/extension-sdk";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import { ensureExtensionLoaded, getQueryParam } from "../utils/request-helpers.js";

export class CatalogController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * GET /api/catalog
   * Browse manga catalog with pagination, search, and filters
   */
  async getCatalog(req: Request, res: Response): Promise<void> {
    const extensionId = ensureExtensionLoaded(
      req,
      res,
      this.deps.host,
      this.deps.activeExtensionId,
    );
    if (!extensionId) return;

    if (!this.deps.catalogService) {
      res.status(503).json({ error: "Catalog service not available" });
      return;
    }

    try {
      const pageParam = getQueryParam(req, "page");
      const page = Number.parseInt((pageParam ?? "1") as string, 10) || 1;
      const query = (() => {
        const queryParam = getQueryParam(req, "query");
        return queryParam && queryParam.trim().length > 0
          ? queryParam
          : undefined;
      })();
      const filtersParam = getQueryParam(req, "filters");
      const filters = filtersParam ? JSON.parse(filtersParam) : undefined;

      const response = await this.deps.catalogService.fetchCataloguePage(
        extensionId,
        {
          page,
          query,
          filters,
        },
      );

      // Enrich cover URLs for all items
      if (response.items.length > 0) {
        for (const item of response.items) {
          const providedUrls = this.deps.coverUrlService.sanitize([
            ...(item.coverUrls ?? []),
            item.coverUrl,
          ]);

          let mergedUrls = providedUrls;
          const storedOrder = this.deps.coverUrlService.getStoredOrder(
            extensionId,
            item.id,
          );
          if (storedOrder && storedOrder.length > 0) {
            mergedUrls = this.deps.coverUrlService.merge(
              storedOrder,
              providedUrls,
            );
          }

          if (mergedUrls.length > 0) {
            item.coverUrls = mergedUrls;
            item.coverUrl = mergedUrls[0];
            if (
              this.deps.repositories &&
              (!storedOrder ||
                !this.deps.coverUrlService.areArraysEqual(storedOrder, mergedUrls))
            ) {
              this.deps.coverUrlService.updateOrder(
                extensionId,
                item.id,
                mergedUrls,
              );
            }
          }

          // Handle cover caching
          if (this.deps.coverCacheManager) {
            try {
              const cached = await this.deps.coverCacheManager.getCachedCover(
                extensionId,
                item.id,
              );

              if (cached) {
                item.cachedCover = {
                  dataUrl: cached.dataUrl,
                  sourceUrl: cached.sourceUrl,
                  updatedAt: new Date(cached.updatedAt).toISOString(),
                  expiresAt: cached.expiresAt
                    ? new Date(cached.expiresAt).toISOString()
                    : undefined,
                  mimeType: cached.mimeType,
                  bytes: cached.bytes,
                };
              } else {
                const urlsForCache = item.coverUrls?.length
                  ? item.coverUrls
                  : item.coverUrl
                    ? [item.coverUrl]
                    : [];

                if (urlsForCache.length > 0) {
                  void this.deps.coverCacheManager
                    .ensureCachedCover(extensionId, item.id, urlsForCache, {
                      title: item.title,
                      slug: item.slug,
                      urls: urlsForCache,
                    })
                    .catch((error) => {
                      console.warn(
                        "Failed to prefetch cover for %s: %s",
                        item.id,
                        String(error),
                      );
                    });
                }
              }
            } catch (error) {
              console.warn("Failed to read cover cache for %s: %s", item.id, String(error));
            }
          }
        }
      }

      // Cache manga summaries for slug lookup
      if (this.deps.repositories && response.items.length > 0) {
        try {
          this.deps.repositories.manga.upsertMangaSummaries(
            extensionId,
            response.items,
          );
        } catch (error) {
          console.warn(
            "Failed to cache catalogue items for slug lookup: %s",
            String(error),
          );
        }
      }

      res.json({ page, ...response, extensionId });
    } catch (error) {
      this.handleError(res, error, "Failed to fetch catalogue page");
    }
  }

  /**
   * GET /api/filters
   * Get available filters for the extension
   */
  async getFilters(req: Request, res: Response): Promise<void> {
    const extensionId = ensureExtensionLoaded(
      req,
      res,
      this.deps.host,
      this.deps.activeExtensionId,
    );
    if (!extensionId) return;

    if (!this.deps.catalogService) {
      res.status(503).json({ error: "Catalog service not available" });
      return;
    }

    try {
      const filters = (await this.deps.catalogService.getFilters(
        extensionId,
      )) as ExtensionFilters | undefined;
      res.json({ filters, extensionId });
    } catch (error) {
      this.handleError(res, error, "Failed to fetch filters");
    }
  }
}
