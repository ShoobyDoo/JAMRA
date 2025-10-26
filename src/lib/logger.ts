/**
 * Logging utility for JAMRA application
 * Provides structured logging with multiple transport support
 */

import { LogLevel, type LogContext, type NetworkLogContext, type LogEntry } from "./logger/types";
import type { LogTransport } from "./logger/transports/base";
import { ConsoleTransport } from "./logger/transports/console";

class Logger {
  private transports: LogTransport[] = [];
  private minLevel: LogLevel = LogLevel.INFO;
  private isDev = false;

  constructor() {
    // Detect environment
    if (typeof process !== "undefined") {
      this.isDev = process.env.NODE_ENV === "development";
      this.minLevel = this.isDev ? LogLevel.DEBUG : LogLevel.INFO;
    }

    // Initialize with console transport by default
    this.addTransport(
      new ConsoleTransport({
        minLevel: this.minLevel,
      }),
    );
  }

  /**
   * Add a transport to the logger
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /**
   * Remove a transport by name
   */
  removeTransport(name: string): void {
    const index = this.transports.findIndex((t) => t.name === name);
    if (index !== -1) {
      const transport = this.transports[index];
      this.transports.splice(index, 1);

      // Close the transport if it supports it
      if (transport.close) {
        void transport.close();
      }
    }
  }

  /**
   * Get all transports
   */
  getTransports(): LogTransport[] {
    return [...this.transports];
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  // Configuration methods for backward compatibility
  enableVerboseLogging(): void {
    this.minLevel = LogLevel.DEBUG;
  }

  enableProductionLogging(): void {
    this.minLevel = LogLevel.INFO;
  }

  disableLogging(): void {
    this.minLevel = LogLevel.OFF;
  }

  isVerboseLoggingEnabled(): boolean {
    return this.minLevel <= LogLevel.DEBUG;
  }

  getCurrentLogLevel(): LogLevel {
    return this.minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): LogEntry {
    return {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context);

    // Send to all transports
    for (const transport of this.transports) {
      try {
        const result = transport.log(entry);
        // Handle async transports
        if (result && typeof result.catch === "function") {
          result.catch((error) => {
            // eslint-disable-next-line no-console -- Fallback error logging
            console.error(
              `[Logger] Transport ${transport.name} failed:`,
              error,
            );
          });
        }
      } catch (error) {
        // eslint-disable-next-line no-console -- Fallback error logging
        console.error(`[Logger] Transport ${transport.name} failed:`, error);
      }
    }
  }

  private logNetwork(
    level: LogLevel,
    message: string,
    context?: NetworkLogContext,
  ): void {
    this.log(level, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  // Network-specific logging methods
  networkRequest(
    url: string,
    method: string,
    context?: Omit<NetworkLogContext, "url" | "method">,
  ): void {
    this.logNetwork(LogLevel.DEBUG, `Network request initiated`, {
      ...context,
      url,
      method,
      timestamp: new Date().toISOString(),
    });
  }

  networkResponse(
    url: string,
    method: string,
    statusCode: number,
    duration: number,
    context?: Omit<
      NetworkLogContext,
      "url" | "method" | "statusCode" | "duration"
    >,
  ): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.DEBUG;
    this.logNetwork(level, `Network response received`, {
      ...context,
      url,
      method,
      statusCode,
      duration,
      timestamp: new Date().toISOString(),
    });
  }

  networkError(
    url: string,
    method: string,
    error: Error,
    duration?: number,
    context?: Omit<NetworkLogContext, "url" | "method" | "error" | "duration">,
  ): void {
    // Check if error is an ApiError with status code
    const isApiError = error && typeof error === "object" && "status" in error;
    const status = isApiError ? (error as { status: number }).status : undefined;
    const message = status
      ? `Network request failed | Status: ${status}`
      : "Network request failed";

    this.logNetwork(LogLevel.ERROR, message, {
      ...context,
      url,
      method,
      error,
      duration,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }

  // Utility methods for common logging scenarios
  apiCall(endpoint: string, method: string, context?: LogContext): void {
    this.networkRequest(endpoint, method, {
      ...context,
      component: "API",
      action: "api-call",
    });
  }

  apiResponse(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    context?: LogContext,
  ): void {
    this.networkResponse(endpoint, method, statusCode, duration, {
      ...context,
      component: "API",
      action: "api-response",
    });
  }

  apiError(
    endpoint: string,
    method: string,
    error: Error,
    duration?: number,
    context?: LogContext,
  ): void {
    this.networkError(endpoint, method, error, duration, {
      ...context,
      component: "API",
      action: "api-error",
    });
  }

  componentMount(componentName: string, context?: LogContext): void {
    this.debug(`Component mounted`, {
      ...context,
      component: componentName,
      action: "mount",
    });
  }

  componentUnmount(componentName: string, context?: LogContext): void {
    this.debug(`Component unmounted`, {
      ...context,
      component: componentName,
      action: "unmount",
    });
  }

  userAction(
    action: string,
    details?: Record<string, unknown>,
    context?: LogContext,
  ): void {
    this.info(`User action: ${action}`, {
      ...context,
      component: "UserInteraction",
      action,
      ...details,
    });
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    this.debug(`Performance: ${operation} took ${duration}ms`, {
      ...context,
      component: "Performance",
      action: operation,
      duration,
    });
  }

  /**
   * Flush all transports (useful before shutdown)
   */
  async flush(): Promise<void> {
    const flushPromises = this.transports
      .filter((t) => t.flush)
      .map((t) => t.flush!());

    await Promise.all(flushPromises);
  }

  /**
   * Close all transports and release resources
   */
  async close(): Promise<void> {
    await this.flush();

    const closePromises = this.transports
      .filter((t) => t.close)
      .map((t) => t.close!());

    await Promise.all(closePromises);

    this.transports = [];
  }
}

// Create and export a singleton logger instance
export const logger = new Logger();

// Export the class for testing or custom instances
export { Logger };
