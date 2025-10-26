#!/usr/bin/env node
/**
 * Offline worker bootstrap.
 *
 * Runs inside a forked Node process and owns the entire offline storage
 * subsystem (catalog access, SQLite repository, download worker, metadata
 * maintenance, etc.). The parent catalog server communicates exclusively
 * through the IPC channel defined in worker-ipc.ts.
 */

import { DownloadWorker } from "./downloader.js";
import { OfflineRepository } from "./repository.js";
import { OfflineStorageManager } from "./manager.js";
import type {
  ResultForCommand,
  WorkerCommand,
  WorkerCommandPayloads,
  WorkerCommandType,
  WorkerInitConfig,
  WorkerMessage,
} from "./worker-ipc.js";
import { isWorkerCommand } from "./worker-ipc.js";

// Dynamic imports to avoid ESM/CJS conflicts when launched via tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
let CatalogDatabase: any;
let CatalogService: any;
let ExtensionHost: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let worker: DownloadWorker | null = null;
let offlineManager: OfflineStorageManager | null = null;
let cleanupCallbacks: Array<() => void | Promise<void>> = [];

const logPrefix = "[Worker]";

function sendToParent(message: WorkerMessage): void {
  if (!process.send) {
    console.error(`${logPrefix} No IPC channel available`);
    return;
  }

  try {
    process.send(message);
  } catch (error) {
    console.error(`${logPrefix} Failed to send IPC message:`, error);
  }
}

function sendError(error: unknown, requestId?: string): void {
  const err =
    error instanceof Error ? error : new Error(String(error ?? "Unknown error"));
  sendToParent({
    type: "error",
    requestId,
    error: err.message,
    stack: err.stack,
  });
}

function sendFatalError(error: unknown): void {
  const err =
    error instanceof Error ? error : new Error(String(error ?? "Unknown error"));
  sendToParent({
    type: "fatal-error",
    error: err.message,
    stack: err.stack,
  });
  setTimeout(() => process.exit(1), 100);
}

function sendResult<T extends WorkerCommandType>(
  command: T,
  requestId: string | undefined,
  result: ResultForCommand<T>,
): void {
  if (!requestId) return;
  sendToParent({
    type: "result",
    requestId,
    command,
    result,
  });
}

function requireWorker(): DownloadWorker {
  if (!worker) {
    throw new Error("Download worker not initialised");
  }
  return worker;
}

function requireOfflineManager(): OfflineStorageManager {
  if (!offlineManager) {
    throw new Error("Offline storage manager not initialised");
  }
  return offlineManager;
}

function requirePayload<T extends WorkerCommandType>(
  command: Extract<WorkerCommand, { type: T }>,
): WorkerCommandPayloads[T] {
  if (!("payload" in command)) {
    throw new Error(`Missing payload for ${command.type} command`);
  }
  return command.payload as WorkerCommandPayloads[T];
}

async function initialize(config: WorkerInitConfig): Promise<void> {
  try {
    const catalogDbModule = await import("@jamra/catalog-db");
    const catalogServiceModule = await import("@jamra/catalog-service");
    const extensionHostModule = await import("@jamra/extension-host");

    CatalogDatabase = catalogDbModule.CatalogDatabase;
    CatalogService = catalogServiceModule.CatalogService;
    ExtensionHost = extensionHostModule.ExtensionHost;

    const database = new CatalogDatabase(config.dbPath);
    cleanupCallbacks.push(() => database.close());

    const host = new ExtensionHost({ database });
    const ExtensionRepository = catalogDbModule.ExtensionRepository;
    const extensionRepository = new ExtensionRepository(database.db);

    const enabledExtensions = extensionRepository.listExtensions({
      status: "enabled",
    });
    console.log(
      `${logPrefix} Found ${enabledExtensions.length} enabled extensions`,
    );

    for (const extension of enabledExtensions) {
      if (!extension.entryPath) {
        console.warn(
          `${logPrefix} Extension ${extension.id} has no entry path, skipping`,
        );
        continue;
      }

      try {
        await host.loadFromFile(extension.entryPath, {
          settings: extension.settings ?? undefined,
        });
        console.log(
          `${logPrefix} Loaded extension: ${
            extension.name || extension.id
          } (${extension.id})`,
        );
      } catch (error) {
        console.error(
          `${logPrefix} Failed to load extension ${extension.id}:`,
          error,
        );
      }
    }

    const catalogService = new CatalogService(host, { database });
    const offlineRepository = new OfflineRepository(database.db);
    const manager = new OfflineStorageManager(
      config.dataDir,
      offlineRepository,
      catalogService,
    );
    offlineManager = manager;

    cleanupCallbacks.push(
      manager.on((event) => {
        sendToParent({ type: "event", event });
      }),
    );

    worker = new DownloadWorker(
      config.dataDir,
      offlineRepository,
      catalogService,
      config.workerOptions,
    );

    cleanupCallbacks.push(
      worker.on((event) => {
        sendToParent({ type: "event", event });
      }),
    );

    sendToParent({ type: "ready", timestamp: Date.now() });
    console.log(`${logPrefix} Initialised successfully`);
  } catch (error) {
    console.error(`${logPrefix} Initialization failed:`, error);
    sendFatalError(error);
  }
}

async function handleCommand(command: WorkerCommand): Promise<void> {
  try {
    switch (command.type) {
      case "start": {
        console.log(`${logPrefix} Received start command`);
        await requireWorker().start();
        sendResult("start", command.requestId, undefined as ResultForCommand<"start">);
        sendToParent({ type: "started", timestamp: Date.now(), requestId: command.requestId });
        break;
      }
      case "stop": {
        console.log(`${logPrefix} Received stop command`);
        if (worker) {
          await worker.stop();
        }
        sendResult("stop", command.requestId, undefined as ResultForCommand<"stop">);
        sendToParent({ type: "stopped", timestamp: Date.now(), requestId: command.requestId });
        break;
      }
      case "ping": {
        sendResult("ping", command.requestId, { timestamp: Date.now() });
        break;
      }
      case "is-active": {
        sendResult("is-active", command.requestId, {
          isActive: worker?.isActive() ?? false,
        });
        break;
      }
      case "get-active-downloads": {
        sendResult("get-active-downloads", command.requestId, {
          activeDownloads: worker?.getActiveDownloads() ?? [],
        });
        break;
      }
      case "queue-chapter": {
        const payload = requirePayload(command);
        console.log(
          `${logPrefix} queue-chapter ${payload.extensionId}/${payload.mangaId}/${payload.chapterId}`,
        );
        const queueId = await requireOfflineManager().queueChapterDownload(
          payload.extensionId,
          payload.mangaId,
          payload.chapterId,
          payload.options ?? {},
        );
        sendResult("queue-chapter", command.requestId, { queueId });
        break;
      }
      case "queue-manga": {
        const payload = requirePayload(command);
        console.log(
          `${logPrefix} queue-manga ${payload.extensionId}/${payload.mangaId}`,
        );
        const queueIds = await requireOfflineManager().queueMangaDownload(
          payload.extensionId,
          payload.mangaId,
          payload.options ?? {},
        );
        sendResult("queue-manga", command.requestId, { queueIds });
        break;
      }
      case "cancel-download": {
        const payload = requirePayload(command);
        await requireOfflineManager().cancelDownload(payload.queueId);
        sendResult(
          "cancel-download",
          command.requestId,
          undefined as ResultForCommand<"cancel-download">,
        );
        break;
      }
      case "retry-download": {
        const payload = requirePayload(command);
        await requireOfflineManager().retryDownload(payload.queueId);
        sendResult(
          "retry-download",
          command.requestId,
          undefined as ResultForCommand<"retry-download">,
        );
        break;
      }
      case "retry-frozen-downloads": {
        const retriedQueueIds =
          await requireOfflineManager().retryFrozenDownloads();
        sendResult("retry-frozen-downloads", command.requestId, {
          retriedQueueIds,
        });
        break;
      }
      case "get-queued-downloads": {
        console.log(`${logPrefix} get-queued-downloads`);
        const queue = await requireOfflineManager().getQueuedDownloads();
        sendResult("get-queued-downloads", command.requestId, { queue });
        break;
      }
      case "get-download-progress": {
        const payload = requirePayload(command);
        console.log(`${logPrefix} get-download-progress queueId=${payload.queueId}`);
        const progress = await requireOfflineManager().getDownloadProgress(
          payload.queueId,
        );
        sendResult("get-download-progress", command.requestId, { progress });
        break;
      }
      case "get-storage-stats": {
        console.log(`${logPrefix} get-storage-stats`);
        const stats = await requireOfflineManager().getStorageStats();
        sendResult("get-storage-stats", command.requestId, { stats });
        break;
      }
      case "get-downloaded-manga": {
        console.log(`${logPrefix} get-downloaded-manga`);
        const manga = await requireOfflineManager().getDownloadedManga();
        sendResult("get-downloaded-manga", command.requestId, { manga });
        break;
      }
      case "get-manga-metadata": {
        const payload = requirePayload(command);
        const metadata = await requireOfflineManager().getMangaMetadata(
          payload.extensionId,
          payload.mangaId,
        );
        sendResult("get-manga-metadata", command.requestId, { metadata });
        break;
      }
      case "get-downloaded-chapters": {
        const payload = requirePayload(command);
        const chapters =
          await requireOfflineManager().getDownloadedChapters(
            payload.extensionId,
            payload.mangaId,
          );
        sendResult("get-downloaded-chapters", command.requestId, { chapters });
        break;
      }
      case "get-chapter-pages": {
        const payload = requirePayload(command);
        const pages = await requireOfflineManager().getChapterPages(
          payload.extensionId,
          payload.mangaId,
          payload.chapterId,
        );
        sendResult("get-chapter-pages", command.requestId, { pages });
        break;
      }
      case "is-chapter-downloaded": {
        const payload = requirePayload(command);
        const downloaded =
          await requireOfflineManager().isChapterDownloaded(
            payload.extensionId,
            payload.mangaId,
            payload.chapterId,
          );
        sendResult("is-chapter-downloaded", command.requestId, { downloaded });
        break;
      }
      case "delete-chapter": {
        const payload = requirePayload(command);
        await requireOfflineManager().deleteChapter(
          payload.extensionId,
          payload.mangaId,
          payload.chapterId,
        );
        sendResult(
          "delete-chapter",
          command.requestId,
          undefined as ResultForCommand<"delete-chapter">,
        );
        break;
      }
      case "delete-manga": {
        const payload = requirePayload(command);
        await requireOfflineManager().deleteManga(
          payload.extensionId,
          payload.mangaId,
        );
        sendResult(
          "delete-manga",
          command.requestId,
          undefined as ResultForCommand<"delete-manga">,
        );
        break;
      }
      case "nuke-offline-data": {
        await requireOfflineManager().nukeOfflineData();
        sendResult(
          "nuke-offline-data",
          command.requestId,
          undefined as ResultForCommand<"nuke-offline-data">,
        );
        break;
      }
      case "get-download-history": {
        const payload = (command.payload ?? {}) as WorkerCommandPayloads["get-download-history"];
        const history = await requireOfflineManager().getDownloadHistory(
          payload.limit,
        );
        sendResult("get-download-history", command.requestId, { history });
        break;
      }
      case "delete-history-item": {
        const payload = requirePayload(command);
        await requireOfflineManager().deleteHistoryItem(payload.historyId);
        sendResult(
          "delete-history-item",
          command.requestId,
          undefined as ResultForCommand<"delete-history-item">,
        );
        break;
      }
      case "clear-download-history": {
        await requireOfflineManager().clearDownloadHistory();
        sendResult(
          "clear-download-history",
          command.requestId,
          undefined as ResultForCommand<"clear-download-history">,
        );
        break;
      }
      case "validate-manga-chapter-count": {
        const payload = requirePayload(command);
        const result =
          await requireOfflineManager().validateMangaChapterCount(
            payload.extensionId,
            payload.mangaId,
          );
        sendResult("validate-manga-chapter-count", command.requestId, result);
        break;
      }
      case "start-background-sync": {
        const payload = requirePayload(command);
        void requireOfflineManager()
          .startBackgroundMetadataSync({
            ttlMs: payload.ttlMs,
            concurrency: payload.concurrency,
            delayMs: payload.delayMs,
          })
          .catch((error) => {
            console.error(
              `${logPrefix} Background metadata sync failed:`,
              error,
            );
          });
        sendResult(
          "start-background-sync",
          command.requestId,
          undefined as ResultForCommand<"start-background-sync">,
        );
        break;
      }
      case "get-page-path": {
        const payload = requirePayload(command);
        const path = requireOfflineManager().getPagePath(
          payload.mangaId,
          payload.chapterId,
          payload.filename,
        );
        sendResult("get-page-path", command.requestId, { path });
        break;
      }
      case "get-metrics": {
        const metrics = requireWorker().getMetrics();
        sendResult("get-metrics", command.requestId, { metrics });
        break;
      }
      case "reset-metrics": {
        requireWorker().resetMetrics();
        sendResult(
          "reset-metrics",
          command.requestId,
          undefined as ResultForCommand<"reset-metrics">,
        );
        break;
      }
      default: {
        const exhaustive: never = command;
        console.warn(`${logPrefix} Unknown command type:`, exhaustive);
      }
    }
  } catch (error) {
    console.error(`${logPrefix} Command ${command.type} failed:`, error);
    sendError(error, command.requestId);
  }
}

async function cleanup(): Promise<void> {
  console.log(`${logPrefix} Cleaning up...`);

  if (worker) {
    try {
      await worker.stop();
    } catch (error) {
      console.error(`${logPrefix} Error stopping download worker:`, error);
    }
  }

  for (const callback of cleanupCallbacks) {
    try {
      await callback();
    } catch (error) {
      console.error(`${logPrefix} Error during cleanup callback:`, error);
    }
  }
  cleanupCallbacks = [];
  worker = null;
  offlineManager = null;
}

async function main(): Promise<void> {
  console.log(`${logPrefix} Process starting...`);

  if (!process.send) {
    console.error(`${logPrefix} Must be launched as a forked child process`);
    process.exit(1);
  }

  process.on("SIGINT", async () => {
    console.log(`${logPrefix} Received SIGINT`);
    await cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log(`${logPrefix} Received SIGTERM`);
    await cleanup();
    process.exit(0);
  });

  process.on("uncaughtException", (error) => {
    console.error(`${logPrefix} Uncaught exception:`, error);
    sendFatalError(error);
  });

  process.on("unhandledRejection", (reason) => {
    console.error(`${logPrefix} Unhandled rejection:`, reason);
    sendFatalError(reason);
  });

  process.on("message", async (message: unknown) => {
    if (!message || typeof message !== "object") {
      console.warn(`${logPrefix} Received invalid IPC payload:`, message);
      return;
    }

    if ("dataDir" in message && "dbPath" in message) {
      await initialize(message as WorkerInitConfig);
      return;
    }

    if (isWorkerCommand(message)) {
      await handleCommand(message);
      return;
    }

    console.warn(`${logPrefix} Received unknown IPC payload:`, message);
  });

  process.on("disconnect", async () => {
    console.log(`${logPrefix} Parent disconnected, shutting down...`);
    await cleanup();
    process.exit(0);
  });

  console.log(`${logPrefix} Waiting for initial configuration...`);
}

main().catch((error) => {
  console.error(`${logPrefix} Fatal error in main:`, error);
  process.exit(1);
});
