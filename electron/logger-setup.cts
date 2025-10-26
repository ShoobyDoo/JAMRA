/**
 * Logger setup for Electron main process
 * Provides file logging to .jamra-data/logs/
 */

import path from "node:path";
import fs from "node:fs";
import fsPromises from "node:fs/promises";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_BACKUPS = 5;

export class ElectronLogger {
  private logDir: string;
  private mainLogFile: string;
  private errorLogFile: string;
  private currentMainSize = 0;
  private currentErrorSize = 0;
  private buffer: string[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(dataDir: string) {
    this.logDir = path.join(dataDir, "logs");
    this.mainLogFile = path.join(this.logDir, "main.log");
    this.errorLogFile = path.join(this.logDir, "error.log");

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Initialize file sizes
    if (fs.existsSync(this.mainLogFile)) {
      this.currentMainSize = fs.statSync(this.mainLogFile).size;
    }
    if (fs.existsSync(this.errorLogFile)) {
      this.currentErrorSize = fs.statSync(this.errorLogFile).size;
    }

    // Start flush timer
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        void this.flush();
      }
    }, 100);
  }

  private formatEntry(level: string, message: string, meta?: unknown): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    }) + "\n";
  }

  debug(message: string, meta?: unknown): void {
    const entry = this.formatEntry("DEBUG", message, meta);
    this.buffer.push(entry);
  }

  info(message: string, meta?: unknown): void {
    const entry = this.formatEntry("INFO", message, meta);
    if (meta !== undefined) {
      console.info(message, meta);
    } else {
      console.info(message);
    }
    this.buffer.push(entry);
  }

  warn(message: string, meta?: unknown): void {
    const entry = this.formatEntry("WARN", message, meta);
    if (meta !== undefined) {
      console.warn(message, meta);
    } else {
      console.warn(message);
    }
    this.buffer.push(entry);
  }

  error(message: string, meta?: unknown): void {
    const entry = this.formatEntry("ERROR", message, meta);
    if (meta !== undefined) {
      console.error(message, meta);
    } else {
      console.error(message);
    }
    this.buffer.push(entry);

    // Also write to error.log
    void this.writeToFile(this.errorLogFile, entry, "error");
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    const content = batch.join("");

    await this.writeToFile(this.mainLogFile, content, "main");
  }

  private async writeToFile(
    filePath: string,
    content: string,
    type: "main" | "error",
  ): Promise<void> {
    try {
      const size = Buffer.byteLength(content, "utf8");
      const currentSize = type === "main" ? this.currentMainSize : this.currentErrorSize;

      if (currentSize + size > MAX_FILE_SIZE) {
        await this.rotateFile(filePath);
        await fsPromises.writeFile(filePath, content, "utf8");
        if (type === "main") {
          this.currentMainSize = size;
        } else {
          this.currentErrorSize = size;
        }
      } else {
        await fsPromises.appendFile(filePath, content, "utf8");
        if (type === "main") {
          this.currentMainSize += size;
        } else {
          this.currentErrorSize += size;
        }
      }
    } catch (error) {
      console.error(`Failed to write to ${filePath}:`, error);
    }
  }

  private async rotateFile(filePath: string): Promise<void> {
    try {
      // Rotate existing files
      for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
        const oldFile = `${filePath}.${i}`;
        const newFile = `${filePath}.${i + 1}`;

        if (fs.existsSync(oldFile)) {
          await fsPromises.rename(oldFile, newFile);
        }
      }

      // Move current file to .1
      if (fs.existsSync(filePath)) {
        await fsPromises.rename(filePath, `${filePath}.1`);
      }
    } catch (error) {
      console.error(`Failed to rotate ${filePath}:`, error);
    }
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}
