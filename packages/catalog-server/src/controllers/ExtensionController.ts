/**
 * Extension Controller
 *
 * Handles all extension-related endpoints
 */

import type { Request, Response } from "express";
import type { ExtensionListOptions, StoredExtensionUpdateState } from "@jamra/catalog-db";
import type { ServerDependencies } from "../types/server-dependencies.js";
import type { InstallExtensionOptions } from "../extensions/extensionManager.js";
import type { ResolvedExtensionVersion } from "../extensions/registryService.js";
import { compareVersions } from "@jamra/extension-registry";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import { coerceSettings, getQueryParam } from "../utils/request-helpers.js";
import { buildSourceMetadata, buildUpdateDetails } from "../utils/extension-helpers.js";

export class ExtensionController {
  constructor(
    private readonly deps: ServerDependencies,
    private activeExtensionIdRef: { current?: string },
  ) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * GET /api/extensions
   * List all installed extensions
   */
  async listExtensions(req: Request, res: Response): Promise<void> {
    try {
      const options: ExtensionListOptions = {};

      const search = getQueryParam(req, "search");
      if (search) options.search = search;

      const status = getQueryParam(req, "status");
      if (status === "enabled" || status === "disabled") {
        options.status = status;
      }

      const sort = getQueryParam(req, "sort");
      if (
        sort === "name" ||
        sort === "installedAt" ||
        sort === "author" ||
        sort === "language"
      ) {
        options.sort = sort;
      }

      const order = getQueryParam(req, "order");
      if (order === "asc" || order === "desc") {
        options.order = order;
      }

      const extensions = this.deps.extensionManager.listExtensions(options);
      res.json({ extensions });
    } catch (error) {
      this.handleError(res, error, "Failed to list extensions");
    }
  }

  /**
   * GET /api/extension-marketplace
   * Get available extensions from registries
   */
  async getMarketplace(_req: Request, res: Response): Promise<void> {
    try {
      const [registries, extensions] = await Promise.all([
        this.deps.registryService.listRegistries(),
        this.deps.registryService.listMarketplaceExtensions(),
      ]);

      res.json({
        registries: registries.map((entry) => ({
          id: entry.source.id,
          label: entry.source.label ?? entry.manifest.registry.name,
          name: entry.manifest.registry.name,
          description: entry.manifest.registry.description ?? null,
          homepage: entry.manifest.registry.homepage ?? null,
          supportUrl: entry.manifest.registry.supportUrl ?? null,
          manifestUrl: entry.source.manifestUrl,
          generatedAt: entry.manifest.generatedAt ?? null,
          fetchedAt: entry.fetchedAt,
          extensionCount: entry.manifest.extensions.length,
          maintainers: entry.manifest.registry.maintainers ?? [],
        })),
        extensions: extensions.map((record) => ({
          registryId: record.registry.id,
          registryLabel: record.registry.label ?? record.registry.id,
          manifestUrl: record.registry.manifestUrl,
          id: record.extension.id,
          name: record.extension.name,
          summary: record.extension.summary,
          description: record.extension.description ?? null,
          homepage: record.extension.homepage ?? null,
          repository: record.extension.repository ?? null,
          icon: record.extension.icon ?? null,
          tags: record.extension.tags ?? [],
          categories: record.extension.categories ?? [],
          author: record.extension.author,
          maintainers: record.extension.maintainers ?? [],
          versions: record.extension.versions,
          latestVersion: record.latestVersion ?? null,
        })),
      });
    } catch (error) {
      this.handleError(res, error, "Failed to query extension marketplace");
    }
  }

  /**
   * POST /api/extensions
   * Install extension from file or registry
   */
  async installExtension(req: Request, res: Response): Promise<void> {
    const { filePath, source, enabled, settings } = req.body ?? {};

    let parsedSettings: Record<string, unknown> | null | undefined;
    try {
      parsedSettings = coerceSettings(settings);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    // Install from registry
    if (source && typeof source === "object") {
      await this.installFromRegistry(
        res,
        source,
        enabled,
        parsedSettings,
      );
      return;
    }

    // Install from file
    if (typeof filePath !== "string" || filePath.trim().length === 0) {
      res.status(400).json({ error: "filePath or source is required." });
      return;
    }

    const installOptions: InstallExtensionOptions = {};
    if (typeof enabled === "boolean") {
      installOptions.enabled = enabled;
    }
    if (parsedSettings !== undefined) {
      installOptions.settings = parsedSettings;
    }

    try {
      const extension = await this.deps.extensionManager.installFromFile(
        filePath,
        installOptions,
      );
      if (extension.enabled && extension.loaded) {
        this.activeExtensionIdRef.current = extension.id;
      } else if (!this.activeExtensionIdRef.current) {
        this.activeExtensionIdRef.current = this.deps.extensionManager.getDefaultExtensionId();
      }
      res.status(201).json({ extension });
    } catch (error) {
      this.handleError(res, error, "Failed to install extension");
    }
  }

  private async installFromRegistry(
    res: Response,
    source: unknown,
    enabled: unknown,
    parsedSettings: Record<string, unknown> | null | undefined,
  ): Promise<void> {
    const registryId =
      typeof source === "object" && source !== null && "registryId" in source && typeof source.registryId === "string"
        ? source.registryId.trim()
        : "";
    const extensionId =
      typeof source === "object" && source !== null && "extensionId" in source && typeof source.extensionId === "string"
        ? source.extensionId.trim()
        : "";
    const version =
      typeof source === "object" && source !== null && "version" in source && typeof source.version === "string"
        ? source.version.trim()
        : undefined;

    if (!registryId || !extensionId) {
      res.status(400).json({
        error:
          "source.registryId and source.extensionId are required to install from a registry.",
      });
      return;
    }

    let resolved: ResolvedExtensionVersion | undefined;
    try {
      resolved = await this.deps.registryService.resolveExtension(
        registryId,
        extensionId,
        { version },
      );
    } catch (error) {
      this.handleError(res, error, "Failed to resolve registry extension");
      return;
    }

    if (!resolved) {
      res.status(404).json({
        error: `Extension ${extensionId} not found in registry ${registryId}.`,
      });
      return;
    }

    let asset: Awaited<
      ReturnType<typeof this.deps.registryService.downloadVersionAsset>
    >;
    try {
      asset = await this.deps.registryService.downloadVersionAsset(resolved);
    } catch (error) {
      this.handleError(res, error, "Failed to download extension asset");
      return;
    }

    const now = Date.now();
    const updateState: StoredExtensionUpdateState = {
      latest: buildUpdateDetails(resolved),
      lastCheckedAt: now,
      acknowledgedVersion: resolved.version.version,
      acknowledgedAt: now,
    };

    const installOptions: InstallExtensionOptions = {
      sourceMetadata: buildSourceMetadata(resolved),
      updateState,
    };

    if (typeof enabled === "boolean") {
      installOptions.enabled = enabled;
    }

    if (parsedSettings !== undefined) {
      installOptions.settings = parsedSettings;
    }

    try {
      const extension = await this.deps.extensionManager.installFromFile(
        asset.filePath,
        installOptions,
      );
      if (extension.enabled && extension.loaded) {
        this.activeExtensionIdRef.current = extension.id;
      } else if (!this.activeExtensionIdRef.current) {
        this.activeExtensionIdRef.current = this.deps.extensionManager.getDefaultExtensionId();
      }
      res.status(201).json({ extension });
    } catch (error) {
      this.handleError(res, error, "Failed to install extension");
    } finally {
      await asset.cleanup();
    }
  }

  /**
   * POST /api/extensions/:id/enable
   * Enable an extension
   */
  async enableExtension(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    const { settings } = req.body ?? {};

    let parsedSettings: Record<string, unknown> | null | undefined;
    try {
      parsedSettings = coerceSettings(settings);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    try {
      const extension = await this.deps.extensionManager.enableExtension(
        id,
        parsedSettings,
      );
      this.activeExtensionIdRef.current = extension.id;
      res.json({ extension });
    } catch (error) {
      const extInfo = this.deps.extensionManager.getExtension(id);
      const extName = extInfo?.manifest.name || id;
      this.handleError(res, error, `Failed to enable ${extName} extension`);
    }
  }

  /**
   * POST /api/extensions/:id/disable
   * Disable an extension
   */
  async disableExtension(req: Request, res: Response): Promise<void> {
    const id = req.params.id;

    try {
      const extension = await this.deps.extensionManager.disableExtension(id);
      if (extension && extension.id === this.activeExtensionIdRef.current) {
        this.activeExtensionIdRef.current = this.deps.extensionManager.getDefaultExtensionId();
      }
      res.json({ extension });
    } catch (error) {
      this.handleError(res, error, "Failed to disable extension");
    }
  }

  /**
   * POST /api/extensions/:id/check-updates
   * Check for extension updates
   */
  async checkUpdates(req: Request, res: Response): Promise<void> {
    const id = req.params.id;

    try {
      const extension = this.deps.extensionManager.getExtension(id);
      if (!extension) {
        res.status(404).json({ error: `Extension ${id} is not installed.` });
        return;
      }

      const registryId = extension.source?.registryId;
      if (!registryId) {
        res.status(400).json({
          error:
            "Extension is not linked to a registry and cannot participate in update checks.",
        });
        return;
      }

      const resolved = await this.deps.registryService.resolveExtension(
        registryId,
        extension.id,
      );
      if (!resolved) {
        res.status(404).json({
          error: `Extension ${extension.id} could not be found in registry ${registryId}.`,
        });
        return;
      }

      const updateDetails = buildUpdateDetails(resolved);
      const now = Date.now();
      const updateState: StoredExtensionUpdateState = {
        latest: updateDetails,
        lastCheckedAt: now,
      };

      if (compareVersions(updateDetails.version, extension.version) <= 0) {
        updateState.acknowledgedVersion = extension.version;
        updateState.acknowledgedAt = now;
      } else if (
        extension.updateState?.acknowledgedVersion === updateDetails.version &&
        extension.updateState.acknowledgedAt
      ) {
        updateState.acknowledgedVersion =
          extension.updateState.acknowledgedVersion;
        updateState.acknowledgedAt = extension.updateState.acknowledgedAt;
      }

      this.deps.extensionManager.updateExtensionUpdateState(id, updateState);
      const updated = this.deps.extensionManager.getExtension(id)!;
      res.json({ extension: updated });
    } catch (error) {
      this.handleError(res, error, "Failed to check for extension updates");
    }
  }

  /**
   * POST /api/extensions/:id/acknowledge-update
   * Acknowledge an available update
   */
  async acknowledgeUpdate(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    const { version } = req.body ?? {};

    if (typeof version !== "string" || version.trim().length === 0) {
      res
        .status(400)
        .json({ error: "version is required to acknowledge an update." });
      return;
    }

    try {
      const extension = this.deps.extensionManager.getExtension(id);
      if (!extension) {
        res.status(404).json({ error: `Extension ${id} is not installed.` });
        return;
      }

      if (
        !extension.updateState?.latest ||
        extension.updateState.latest.version !== version
      ) {
        res.status(400).json({
          error: `Version ${version} is not pending acknowledgement for extension ${id}.`,
        });
        return;
      }

      const now = Date.now();
      const updateState: StoredExtensionUpdateState = {
        ...extension.updateState,
        acknowledgedVersion: version,
        acknowledgedAt: now,
      };

      this.deps.extensionManager.updateExtensionUpdateState(id, updateState);
      const updated = this.deps.extensionManager.getExtension(id)!;
      res.json({ extension: updated });
    } catch (error) {
      this.handleError(res, error, "Failed to acknowledge extension update");
    }
  }

  /**
   * PATCH /api/extensions/:id/settings
   * Update extension settings
   */
  async updateSettings(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    const { settings } = req.body ?? {};

    let parsedSettings: Record<string, unknown> | null | undefined;
    try {
      parsedSettings = coerceSettings(settings);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    if (parsedSettings === undefined) {
      res.status(400).json({ error: "settings payload is required." });
      return;
    }

    try {
      const extension = await this.deps.extensionManager.updateSettings(
        id,
        parsedSettings,
      );
      res.json({ extension });
    } catch (error) {
      this.handleError(res, error, "Failed to update extension settings");
    }
  }

  /**
   * DELETE /api/extensions/:id
   * Uninstall an extension
   */
  async uninstallExtension(req: Request, res: Response): Promise<void> {
    const id = req.params.id;

    try {
      await this.deps.extensionManager.uninstallExtension(id);
      if (this.activeExtensionIdRef.current === id) {
        this.activeExtensionIdRef.current = this.deps.extensionManager.getDefaultExtensionId();
      }
      res.status(204).end();
    } catch (error) {
      this.handleError(res, error, "Failed to uninstall extension");
    }
  }
}
