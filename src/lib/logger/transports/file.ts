/**
 * File transport for JAMRA logging system
 * Writes logs to files with rotation support
 * Only available in Node.js/Electron environments
 */

import type { LogTransport, TransportOptions } from "./base";
import type { LogEntry } from "../types";
import { LogLevel } from "../types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_BACKUPS = 5;
const BATCH_INTERVAL_MS = 100;
const BATCH_SIZE = 50;

interface FileTransportOptions extends TransportOptions {
  filePath: string;
  maxFileSize?: number;
  maxBackups?: number;
  batchInterval?: number;
  batchSize?: number;
}

export class FileTransport implements LogTransport {
  readonly name = "file";
  readonly minLevel: LogLevel;
  private readonly filePath: string;
  private readonly maxFileSize: number;
  private readonly maxBackups: number;
  private readonly batchInterval: number;
  private readonly batchSize: number;

  private buffer: string[] = [];
  private flushTimer?: NodeJS.Timeout;
  private writePromise?: Promise<void>;
  private currentSize = 0;
  private isClosing = false;

  // Lazy-loaded Node.js modules (only when actually used)
  private fs?: typeof import("node:fs/promises");
  private fsSync?: typeof import("node:fs");
  private path?: typeof import("node:path");

  constructor(options: FileTransportOptions) {
    this.minLevel = options.minLevel ?? LogLevel.INFO;
    this.filePath = options.filePath;
    this.maxFileSize = options.maxFileSize ?? MAX_FILE_SIZE;
    this.maxBackups = options.maxBackups ?? MAX_BACKUPS;
    this.batchInterval = options.batchInterval ?? BATCH_INTERVAL_MS;
    this.batchSize = options.batchSize ?? BATCH_SIZE;

    // Initialize file size
    this.initializeFileSize().catch(() => {
      // Ignore errors during initialization
    });

    // Start flush timer
    this.startFlushTimer();
  }

  private async loadModules(): Promise<void> {
    if (!this.fs) {
      this.fs = await import("node:fs/promises");
    }
    if (!this.fsSync) {
      this.fsSync = await import("node:fs");
    }
    if (!this.path) {
      this.path = await import("node:path");
    }
  }

  private async initializeFileSize(): Promise<void> {
    try {
      await this.loadModules();
      if (!this.fsSync) return;

      if (this.fsSync.existsSync(this.filePath)) {
        const stats = this.fsSync.statSync(this.filePath);
        this.currentSize = stats.size;
      } else {
        // Ensure directory exists
        const dir = this.path?.dirname(this.filePath);
        if (dir && this.fs) {
          await this.fs.mkdir(dir, { recursive: true });
        }
      }
    } catch {
      // Silently fail - file might not exist yet
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        void this.flush();
      }
    }, this.batchInterval);
  }

  log(entry: LogEntry): void {
    if (entry.level < this.minLevel || this.isClosing) {
      return;
    }

    // Format as newline-delimited JSON (NDJSON)
    const logLine = JSON.stringify({
      timestamp: entry.timestamp,
      level: LogLevel[entry.level],
      message: entry.message,
      context: entry.context,
    });

    this.buffer.push(logLine + "\n");

    // Flush if batch size reached
    if (this.buffer.length >= this.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    // Get current batch and clear buffer
    const batch = this.buffer.splice(0);
    const content = batch.join("");
    const contentSize = Buffer.byteLength(content, "utf8");

    // Wait for any pending write
    if (this.writePromise) {
      await this.writePromise;
    }

    // Check if rotation is needed
    if (this.currentSize + contentSize > this.maxFileSize) {
      this.writePromise = this.rotateAndWrite(content, contentSize);
    } else {
      this.writePromise = this.write(content, contentSize);
    }

    await this.writePromise;
    this.writePromise = undefined;
  }

  private async write(content: string, size: number): Promise<void> {
    try {
      await this.loadModules();
      if (!this.fs) return;

      await this.fs.appendFile(this.filePath, content, "utf8");
      this.currentSize += size;
    } catch (error) {
      // Write to console as fallback
      // eslint-disable-next-line no-console -- Fallback when file logging fails
      console.error(`[FileTransport] Failed to write to ${this.filePath}:`, error);
    }
  }

  private async rotateAndWrite(content: string, size: number): Promise<void> {
    try {
      await this.loadModules();
      if (!this.fs || !this.fsSync || !this.path) return;

      // Rotate existing files: file.log.4 -> file.log.5, etc.
      for (let i = this.maxBackups - 1; i >= 1; i--) {
        const oldFile = `${this.filePath}.${i}`;
        const newFile = `${this.filePath}.${i + 1}`;

        if (this.fsSync.existsSync(oldFile)) {
          await this.fs.rename(oldFile, newFile);
        }
      }

      // Move current file to .1
      if (this.fsSync.existsSync(this.filePath)) {
        await this.fs.rename(this.filePath, `${this.filePath}.1`);
      }

      // Write new content to fresh file
      await this.fs.writeFile(this.filePath, content, "utf8");
      this.currentSize = size;
    } catch (error) {
      // eslint-disable-next-line no-console -- Fallback when file rotation fails
      console.error(`[FileTransport] Failed to rotate ${this.filePath}:`, error);
      // Try to write anyway
      await this.write(content, size);
    }
  }

  async close(): Promise<void> {
    this.isClosing = true;

    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush remaining buffer
    await this.flush();
  }
}
