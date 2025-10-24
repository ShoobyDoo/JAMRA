import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DownloadWorkerOptions } from "./downloader.js";
import type {
  DownloadChapterOptions,
  DownloadHistoryItem,
  DownloadMangaOptions,
  DownloadProgress,
  OfflineChapterMetadata,
  OfflineChapterPages,
  OfflineMangaMetadata,
  OfflineStorageEvent,
  OfflineStorageEventListener,
  QueuedDownload,
  StorageStats,
} from "./types.js";
import type {
  WorkerInitConfig,
  WorkerCommand,
  WorkerCommandType,
  WorkerCommandPayloads,
  ResultForCommand,
  WorkerMessage,
} from "./worker-ipc.js";
import { isWorkerMessage, DEFAULT_IPC_TIMEOUTS } from "./worker-ipc.js";
import type { PerformanceMetrics } from "./utils/performance-metrics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logPrefix = "[WorkerHost]";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  command: WorkerCommandType;
}

export interface DownloadWorkerHostOptions extends DownloadWorkerOptions {
  autoRestart?: boolean;
  maxRestarts?: number;
  restartWindow?: number;
}

export class DownloadWorkerHost {
  private childProcess: ChildProcess | null = null;
  private readonly eventListeners: Set<OfflineStorageEventListener> = new Set();
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private nextRequestId = 1;
  private isInitialized = false;
  private isStarted = false;
  private restartAttempts: number[] = [];
  private initializationPromise: Promise<void> | null = null;
  private readonly autoRestart: boolean;
  private readonly maxRestarts: number;
  private readonly restartWindow: number;
  private readonly dataDir: string;
  private readonly dbPath: string;
  private readonly extensionPath?: string;
  private readonly extensionId?: string;
  private readonly options: DownloadWorkerHostOptions;

  constructor(
    dataDir: string,
    dbPath: string,
    extensionPath: string | undefined,
    extensionId: string | undefined,
    options: DownloadWorkerHostOptions = {},
  ) {
    this.dataDir = dataDir;
    this.dbPath = dbPath;
    this.extensionPath = extensionPath;
    this.extensionId = extensionId;
    this.options = options;
    this.autoRestart = options.autoRestart ?? true;
    this.maxRestarts = options.maxRestarts ?? 5;
    this.restartWindow = options.restartWindow ?? 60_000;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  on(listener: OfflineStorageEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      console.warn(`${logPrefix} Worker already started`);
      return;
    }
    await this.ensureInitialized();
    await this.request("start", undefined, DEFAULT_IPC_TIMEOUTS.startTimeout);
    this.isStarted = true;
    console.log(`${logPrefix} Worker started`);
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    try {
      console.log(`${logPrefix} Sending stop command`);
      await this.request("stop", undefined, DEFAULT_IPC_TIMEOUTS.stopTimeout);
    } catch (error) {
      console.error(`${logPrefix} Error stopping worker:`, error);
    }
    this.isStarted = false;
    await this.killWorker();
  }

  async destroy(): Promise<void> {
    console.log(`${logPrefix} Destroying worker host`);
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Worker host destroyed"));
    }
    this.pendingRequests.clear();
    if (this.isStarted) {
      await this.stop();
    } else {
      await this.killWorker();
    }
    this.eventListeners.clear();
    this.isInitialized = false;
  }

  async isActive(): Promise<boolean> {
    if (!this.isInitialized || !this.childProcess) return false;
    try {
      const result = await this.request("is-active");
      return result.isActive;
    } catch {
      return false;
    }
  }

  async getActiveDownloads(): Promise<number[]> {
    if (!this.isInitialized || !this.childProcess) return [];
    try {
      const result = await this.request("get-active-downloads");
      return result.activeDownloads;
    } catch {
      return [];
    }
  }

  async queueChapterDownload(
    extensionId: string,
    mangaId: string,
    chapterId: string,
    options: DownloadChapterOptions = {},
  ): Promise<number> {
    const result = await this.request("queue-chapter", {
      extensionId,
      mangaId,
      chapterId,
      options,
    });
    return result.queueId;
  }

  async queueMangaDownload(
    extensionId: string,
    mangaId: string,
    options: DownloadMangaOptions = {},
  ): Promise<number[]> {
    const result = await this.request("queue-manga", {
      extensionId,
      mangaId,
      options,
    });
    return result.queueIds;
  }

  async cancelDownload(queueId: number): Promise<void> {
    await this.request("cancel-download", { queueId });
  }

  async retryDownload(queueId: number): Promise<void> {
    await this.request("retry-download", { queueId });
  }

  async retryFrozenDownloads(): Promise<number[]> {
    const result = await this.request("retry-frozen-downloads");
    return result.retriedQueueIds;
  }

  async getQueuedDownloads(): Promise<QueuedDownload[]> {
    const result = await this.request("get-queued-downloads");
    return result.queue;
  }

  async getDownloadProgress(queueId: number): Promise<DownloadProgress | null> {
    const result = await this.request("get-download-progress", { queueId });
    return result.progress;
  }

  async getStorageStats(): Promise<StorageStats> {
    const result = await this.request("get-storage-stats");
    return result.stats;
  }

  async getDownloadedManga(): Promise<OfflineMangaMetadata[]> {
    const result = await this.request("get-downloaded-manga");
    return result.manga;
  }

  async getMangaMetadata(
    extensionId: string,
    mangaId: string,
  ): Promise<OfflineMangaMetadata | null> {
    const result = await this.request("get-manga-metadata", {
      extensionId,
      mangaId,
    });
    return result.metadata;
  }

  async getDownloadedChapters(
    extensionId: string,
    mangaId: string,
  ): Promise<OfflineChapterMetadata[]> {
    const result = await this.request("get-downloaded-chapters", {
      extensionId,
      mangaId,
    });
    return result.chapters;
  }

  async getChapterPages(
    extensionId: string,
    mangaId: string,
    chapterId: string,
  ): Promise<OfflineChapterPages | null> {
    const result = await this.request("get-chapter-pages", {
      extensionId,
      mangaId,
      chapterId,
    });
    return result.pages;
  }

  async isChapterDownloaded(
    extensionId: string,
    mangaId: string,
    chapterId: string,
  ): Promise<boolean> {
    const result = await this.request("is-chapter-downloaded", {
      extensionId,
      mangaId,
      chapterId,
    });
    return result.downloaded;
  }

  async deleteChapter(
    extensionId: string,
    mangaId: string,
    chapterId: string,
  ): Promise<void> {
    await this.request("delete-chapter", { extensionId, mangaId, chapterId });
  }

  async deleteManga(extensionId: string, mangaId: string): Promise<void> {
    await this.request("delete-manga", { extensionId, mangaId });
  }

  async nukeOfflineData(): Promise<void> {
    await this.request("nuke-offline-data");
  }

  async getDownloadHistory(limit?: number): Promise<DownloadHistoryItem[]> {
    const result = await this.request("get-download-history", { limit });
    return result.history;
  }

  async deleteHistoryItem(historyId: number): Promise<void> {
    await this.request("delete-history-item", { historyId });
  }

  async clearDownloadHistory(): Promise<void> {
    await this.request("clear-download-history");
  }

  async validateMangaChapterCount(
    extensionId: string,
    mangaId: string,
  ): Promise<{ valid: boolean; rebuilt: boolean }> {
    return this.request("validate-manga-chapter-count", {
      extensionId,
      mangaId,
    });
  }

  async startBackgroundMetadataSync(options: {
    ttlMs: number;
    concurrency?: number;
    delayMs?: number;
  }): Promise<void> {
    await this.request("start-background-sync", options);
  }

  async getPagePath(
    mangaId: string,
    chapterId: string,
    filename: string,
  ): Promise<string | null> {
    const result = await this.request("get-page-path", {
      mangaId,
      chapterId,
      filename,
    });
    return result.path;
  }

  async getMetrics(): Promise<PerformanceMetrics | null> {
    if (!this.isInitialized || !this.childProcess) return null;
    try {
      const result = await this.request("get-metrics");
      return result.metrics;
    } catch {
      return null;
    }
  }

  async resetMetrics(): Promise<void> {
    await this.request("reset-metrics");
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }
    console.log(`${logPrefix} ensureInitialized triggered`);
    this.initializationPromise = this.initialize();
    await this.initializationPromise;
  }

  private async initialize(): Promise<void> {
    console.log(`${logPrefix} Initialising worker process...`);
    const workerScriptPath = path.join(__dirname, "download-worker-process.js");

    this.childProcess = fork(workerScriptPath, [], {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV ?? "production",
      },
    });

    this.setupProcessHandlers();

    const readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.childProcess?.off("message", handleReadyMessage);
        reject(new Error("Worker initialization timeout"));
      }, DEFAULT_IPC_TIMEOUTS.readyTimeout);

      const handleReadyMessage = (message: unknown) => {
        if (!isWorkerMessage(message)) return;
        if (message.type === "ready") {
          clearTimeout(timeout);
          this.childProcess?.off("message", handleReadyMessage);
          resolve();
        } else if (message.type === "fatal-error") {
          clearTimeout(timeout);
          this.childProcess?.off("message", handleReadyMessage);
          reject(new Error(`Worker fatal error: ${message.error}`));
        }
      };

      this.childProcess?.on("message", handleReadyMessage);
    });

    const initConfig: WorkerInitConfig = {
      dataDir: this.dataDir,
      dbPath: this.dbPath,
      extensionPath: this.extensionPath ?? "",
      extensionId: this.extensionId ?? "",
      workerOptions: {
        concurrency: this.options.concurrency,
        pollingInterval: this.options.pollingInterval,
        chapterConcurrency: this.options.chapterConcurrency,
        chapterDelayMs: this.options.chapterDelayMs,
      },
    };

    this.childProcess.send(initConfig);
    await readyPromise;
    this.isInitialized = true;
    this.initializationPromise = null;
      console.log(`${logPrefix} Worker initialised`);
  }

  private setupProcessHandlers(): void {
    if (!this.childProcess) return;

    this.childProcess.on("message", (message: unknown) => {
      this.handleWorkerMessage(message);
    });

    this.childProcess.on("exit", (code, signal) => {
      console.log(
        `${logPrefix} Worker exited with code ${code}, signal ${signal}`,
      );
      this.childProcess = null;
      this.isInitialized = false;
      this.isStarted = false;

      for (const [requestId, pending] of this.pendingRequests.entries()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Worker process exited"));
      }
      this.pendingRequests.clear();

      if (this.autoRestart && code !== 0) {
        void this.attemptRestart();
      }
    });

    this.childProcess.on("error", (error) => {
        console.error(`${logPrefix} Worker process error:`, error);
    });
  }

  private async attemptRestart(): Promise<void> {
    const now = Date.now();
    this.restartAttempts = this.restartAttempts.filter(
      (timestamp) => now - timestamp < this.restartWindow,
    );

    if (this.restartAttempts.length >= this.maxRestarts) {
      console.error(
        `${logPrefix} Max restart attempts (${this.maxRestarts}) exceeded`,
      );
      return;
    }

    this.restartAttempts.push(now);
    console.log(
      `${logPrefix} Attempting worker restart (${this.restartAttempts.length}/${this.maxRestarts})...`,
    );

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await this.ensureInitialized();
      if (this.isStarted) {
        await this.start();
      }
      console.log(`${logPrefix} Worker restarted successfully`);
    } catch (error) {
      console.error(`${logPrefix} Failed to restart worker:`, error);
    }
  }

  private async killWorker(): Promise<void> {
    if (!this.childProcess) return;

    await new Promise<void>((resolve) => {
      if (!this.childProcess) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        console.warn(
          `${logPrefix} Worker did not exit gracefully, sending SIGKILL`,
        );
        this.childProcess?.kill("SIGKILL");
      }, 5000);

      this.childProcess.once("exit", () => {
        clearTimeout(timeout);
        this.childProcess = null;
        resolve();
      });

      this.childProcess.kill("SIGTERM");
    });
  }

  private handleWorkerMessage(message: unknown): void {
    if (!isWorkerMessage(message)) {
      console.warn(`${logPrefix} Received invalid worker message:`, message);
      return;
    }

    switch (message.type) {
      case "event":
        this.emitEvent(message.event);
        return;
      case "started":
        console.log(`${logPrefix} Worker signalled started`);
        return;
      case "stopped":
        console.log(`${logPrefix} Worker signalled stopped`);
        return;
      case "result": {
        const pending = this.pendingRequests.get(message.requestId);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.requestId);
        console.log(
          `${logPrefix} <- ${pending.command} (requestId=${message.requestId})`,
        );
        pending.resolve(message.result);
        return;
      }
      case "error": {
        if (message.requestId) {
          const pending = this.pendingRequests.get(message.requestId);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(message.requestId);
            pending.reject(new Error(message.error));
            return;
          }
        }
        console.error(`${logPrefix} Worker error:`, message.error);
        if (message.stack) {
          console.error(message.stack);
        }
        return;
      }
      case "fatal-error":
        console.error(`${logPrefix} Worker fatal error:`, message.error);
        if (message.stack) {
          console.error(message.stack);
        }
        return;
      case "ready":
        // handled separately during initialization
        return;
      default:
        return;
    }
  }

  private emitEvent(event: OfflineStorageEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`${logPrefix} Error in event listener:`, error);
      }
    }
  }

  private async request<T extends WorkerCommandType>(
    command: T,
    payload?: WorkerCommandPayloads[T],
    timeoutMs: number = DEFAULT_IPC_TIMEOUTS.queryTimeout,
  ): Promise<ResultForCommand<T>> {
    await this.ensureInitialized();
    if (!this.childProcess) {
      throw new Error("Worker process not available");
    }

    const requestId = String(this.nextRequestId++);
    const message = (
      payload === undefined
        ? { type: command, requestId }
        : { type: command, requestId, payload }
    ) as WorkerCommand;

    return new Promise<ResultForCommand<T>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        console.error(
          `${logPrefix} Command ${command} timed out (requestId=${requestId})`,
        );
        reject(new Error(`Worker command timeout: ${command}`));
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        command,
        timeout,
        reject: (error) => reject(error),
        resolve: (value) => {
          resolve(value as ResultForCommand<T>);
        },
      });

      try {
        console.log(`${logPrefix} -> ${command} (requestId=${requestId})`);
        this.childProcess!.send(message);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}
