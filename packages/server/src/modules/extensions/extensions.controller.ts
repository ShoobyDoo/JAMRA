import type { Request, Response } from "express";
import { DomainError, ValidationError } from "../../shared/errors.js";
import type {
  ExtensionRegistry,
  ExtensionRuntime,
} from "./extensions.types.js";
import {
  normalizeSearchFilters,
  pruneUnsupportedFilters,
  stripUnsupportedRawFilters,
  type Chapter,
  type ChapterPayload,
  type MangaDetailsPayload,
  type MangaDetailsResult,
  type MangaSearchResult,
  type PagesResult,
  type SearchPayload,
} from "@jamra/extension-sdk";
import type { InstallerService } from "../installer/installer.service.js";

export class ExtensionsController {
  constructor(
    private readonly registry: ExtensionRegistry,
    private readonly runtime: ExtensionRuntime,
    private readonly installer?: InstallerService,
  ) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    try {
      const extensions = await this.registry.list();
      res.json({ extensions });
    } catch (_error) {
      res.status(500).json({ message: "Failed to list extensions." });
    }
  };

  detail = async (req: Request, res: Response): Promise<void> => {
    try {
      const extension = await this.requireExtension(req.params.extensionId);
      res.json({ extension });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  search = async (req: Request, res: Response): Promise<void> => {
    try {
      const extension = await this.requireExtension(req.params.extensionId);
      const rawQuery = req.query as Record<string, unknown>;
      const normalizedFilters = normalizeSearchFilters(rawQuery);
      const { filters: supportedFilters, removed } = pruneUnsupportedFilters(
        extension.manifest.capabilities,
        normalizedFilters,
      );
      const sanitizedRawFilters =
        removed.length > 0
          ? stripUnsupportedRawFilters(rawQuery, removed)
          : rawQuery;
      const payload: SearchPayload = {
        query: typeof req.query.query === "string" ? req.query.query : "",
        page: Number.parseInt(req.query.page as string, 10) || 1,
        filters: buildAdditionalFilters(req.query),
        normalizedFilters: supportedFilters,
        rawFilters: sanitizedRawFilters,
      };
      const result = await this.runtime.execute<SearchPayload, MangaSearchResult>(
        extension,
        "search",
        payload,
      );
      res.json(result);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  mangaDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const extension = await this.requireExtension(req.params.extensionId);
      const includeChapters = resolveIncludeChapters(req.query);
      const payload: MangaDetailsPayload = {
        mangaId: req.params.mangaId,
        includeChapters,
      };
      const result = await this.runtime.execute<
        MangaDetailsPayload,
        MangaDetailsResult
      >(extension, "getMangaDetails", payload);
      res.json(result);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  chapters = async (req: Request, res: Response): Promise<void> => {
    try {
      const extension = await this.requireExtension(req.params.extensionId);
      const payload: MangaDetailsPayload = {
        mangaId: req.params.mangaId,
      };
      const chapters = await this.runtime.execute<
        MangaDetailsPayload,
        Chapter[]
      >(extension, "getChapters", payload);
      res.json({ chapters, metrics: { totalChapters: chapters.length } });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  pages = async (req: Request, res: Response): Promise<void> => {
    try {
      const extension = await this.requireExtension(req.params.extensionId);
      const payload: ChapterPayload = {
        mangaId: req.params.mangaId,
        chapterId: req.params.chapterId,
      };
      const result = await this.runtime.execute<ChapterPayload, PagesResult>(
        extension,
        "getPages",
        payload,
      );
      res.json(result);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  install = async (req: Request, res: Response): Promise<void> => {
    if (!this.installer) {
      res.status(501).json({ message: "Extension installer is not available." });
      return;
    }

    try {
      const { repositoryUrl, extensionIds, branch } = req.body as {
        repositoryUrl?: string;
        extensionIds?: string[];
        branch?: string;
      };

      if (!repositoryUrl) {
        res.status(400).json({ message: "repositoryUrl is required" });
        return;
      }

      const jobIds = await this.installer.queueInstall(
        repositoryUrl,
        extensionIds,
        branch,
      );

      res.status(202).json({
        message: "Installation queued",
        jobIds,
        status: "queued",
      });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  getInstallStatus = async (req: Request, res: Response): Promise<void> => {
    if (!this.installer) {
      res.status(501).json({ message: "Extension installer is not available." });
      return;
    }

    try {
      const { jobId } = req.params;
      if (!jobId) {
        res.status(400).json({ message: "jobId is required" });
        return;
      }

      const job = this.installer.getInstallStatus(jobId);
      if (!job) {
        res.status(404).json({ message: "Installation job not found" });
        return;
      }

      res.json({
        jobId: job.id,
        extensionId: job.extension_id,
        status: job.status,
        repositoryUrl: job.repo_url,
        requestedAt: job.requested_at,
        completedAt: job.completed_at,
        error: job.error,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  private async requireExtension(id: string) {
    const extension = await this.registry.findById(id);
    if (!extension) {
      throw new ValidationError(`Extension ${id} not found`);
    }
    await this.runtime.initialise(extension);
    return extension;
  }

  private handleError(res: Response, error: unknown): void {
    if (error instanceof ValidationError || error instanceof DomainError) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: "Extension request failed." });
  }
}

const buildAdditionalFilters = (
  query: Request["query"],
): Record<string, unknown> => {
  const filters: Record<string, unknown> = {};
  const countParam = query.count ?? query.limit ?? query.per_page;
  const parsed = parseInt(`${countParam}`, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    filters.count = Math.min(parsed, 120);
  }
  return filters;
};

const resolveIncludeChapters = (query: Request["query"]): boolean => {
  const includeParam = parseBooleanParam(query.includeChapters);
  if (includeParam !== undefined) {
    return includeParam;
  }
  const compactParam = parseBooleanParam(query.compact);
  if (compactParam === true) {
    return false;
  }
  return true;
};

const parseBooleanParam = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return parseBooleanParam(value[0]);
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};
