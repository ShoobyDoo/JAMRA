/**
 * Extension logger implementation
 * Creates scoped logger instances for extensions with file transport support
 */

import type { ExtensionLogger } from "@jamra/extension-sdk";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class NamespacedLogger implements ExtensionLogger {
  private readonly namespace: string;
  private readonly minLevel: LogLevel;
  private readonly logToFile: (namespace: string, level: LogLevel, message: string, meta?: Record<string, unknown>) => void;

  constructor(
    namespace: string,
    minLevel: LogLevel,
    logToFile: (namespace: string, level: LogLevel, message: string, meta?: Record<string, unknown>) => void,
  ) {
    this.namespace = namespace;
    this.minLevel = minLevel;
    this.logToFile = logToFile;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private format(message: string, meta?: Record<string, unknown>): string {
    const prefix = `[${this.namespace}]`;
    if (meta && Object.keys(meta).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(meta)}`;
    }
    return `${prefix} ${message}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      console.debug(this.format(message, meta));
      this.logToFile(this.namespace, "debug", message, meta);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      console.info(this.format(message, meta));
      this.logToFile(this.namespace, "info", message, meta);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      console.warn(this.format(message, meta));
      this.logToFile(this.namespace, "warn", message, meta);
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      console.error(this.format(message, meta));
      this.logToFile(this.namespace, "error", message, meta);
    }
  }
}

interface LogEntry {
  timestamp: string;
  level: string;
  namespace: string;
  message: string;
  meta?: Record<string, unknown>;
  args?: unknown[];
}

/**
 * Logger factory for creating extension loggers
 */
export class LoggerFactory {
  private fileTransports: Map<string, { write: (entry: LogEntry) => void }> = new Map();
  private baseLogDir?: string;

  /**
   * Set the base directory for log files
   */
  setLogDirectory(dir: string): void {
    this.baseLogDir = dir;
  }

  /**
   * Create a logger for an extension
   * Automatically creates a file transport for the extension
   */
  createLogger(namespace: string, level?: LogLevel): ExtensionLogger {
    const envLevel =
      (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) ?? level ?? "info";

    // Setup file transport if we have a log directory
    if (this.baseLogDir && !this.fileTransports.has(namespace)) {
      void this.setupFileTransport(namespace);
    }

    return new NamespacedLogger(namespace, envLevel, (ns, lvl, msg, meta) => {
      this.logToFile(ns, lvl, msg, meta);
    });
  }

  private async setupFileTransport(namespace: string): Promise<void> {
    try {
      const path = await import("node:path");
      const fs = await import("node:fs/promises");

      if (!this.baseLogDir) return;

      // Ensure logs directory exists
      await fs.mkdir(this.baseLogDir, { recursive: true });

      // Create sanitized filename
      const safeNamespace = namespace.replace(/[^a-zA-Z0-9-_.]/g, "_");
      const logFile = path.join(this.baseLogDir, `ext-${safeNamespace}.log`);

      // Create a simple write function
      const writeToFile = (entry: LogEntry) => {
        const logLine = JSON.stringify(entry) + "\n";
        void fs.appendFile(logFile, logLine, "utf8").catch((error) => {
          console.error(`[LoggerFactory] Failed to write to ${logFile}:`, error);
        });
      };

      this.fileTransports.set(namespace, { write: writeToFile });
    } catch (error) {
      console.error(`[LoggerFactory] Failed to setup file transport for ${namespace}:`, error);
    }
  }

  private logToFile(
    namespace: string,
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const transport = this.fileTransports.get(namespace);
    if (transport) {
      transport.write({
        timestamp: new Date().toISOString(),
        level,
        namespace,
        message,
        meta,
      });
    }
  }

  /**
   * Close all file transports
   */
  async close(): Promise<void> {
    this.fileTransports.clear();
  }
}

// Export singleton factory
export const loggerFactory = new LoggerFactory();

/**
 * Create a logger instance (legacy API)
 */
export function createLogger(namespace: string, level?: LogLevel): ExtensionLogger {
  return loggerFactory.createLogger(namespace, level);
}
