/**
 * Base transport interface for JAMRA logging system
 *
 * Transports handle the actual output of log entries (console, file, remote, etc.)
 */

import type { LogEntry, LogLevel } from "../types";

export interface LogTransport {
  /**
   * Name of the transport (for debugging)
   */
  readonly name: string;

  /**
   * Minimum log level this transport will handle
   */
  readonly minLevel: LogLevel;

  /**
   * Write a log entry to the transport
   */
  log(entry: LogEntry): void | Promise<void>;

  /**
   * Flush any buffered log entries (optional)
   */
  flush?(): void | Promise<void>;

  /**
   * Close the transport and release resources (optional)
   */
  close?(): void | Promise<void>;
}

export interface TransportOptions {
  minLevel?: LogLevel;
}
