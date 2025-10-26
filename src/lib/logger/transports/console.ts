/**
 * Console transport for JAMRA logging system
 * Outputs logs to the console with color coding
 */

import type { LogTransport, TransportOptions } from "./base";
import type { LogEntry } from "../types";
import { LogLevel } from "../types";

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
} as const;

function colorize(text: string, color: keyof typeof colors): string {
  // Only colorize in TTY terminals (not in logs or CI)
  if (typeof process !== "undefined" && process.stdout?.isTTY) {
    return `${colors[color]}${text}${colors.reset}`;
  }
  return text;
}

export class ConsoleTransport implements LogTransport {
  readonly name = "console";
  readonly minLevel: LogLevel;
  private readonly isDev: boolean;

  constructor(options: TransportOptions = {}) {
    this.minLevel = options.minLevel ?? LogLevel.INFO;
    this.isDev =
      typeof process !== "undefined" && process.env.NODE_ENV === "development";
  }

  log(entry: LogEntry): void {
    if (entry.level < this.minLevel) {
      return;
    }

    const timestamp = colorize(
      new Date(entry.timestamp).toISOString(),
      "gray",
    );
    const levelName = this.formatLevel(entry.level);
    const component = entry.context?.component
      ? colorize(`[${entry.context.component}]`, "cyan")
      : "";
    const action = entry.context?.action
      ? colorize(`(${entry.context.action})`, "magenta")
      : "";

    const message = `${timestamp} ${levelName} ${component}${action} ${entry.message}`;

    // In development, pretty-print context; in production, stringify compactly
    const contextStr = this.formatContext(entry.context);

    /* eslint-disable no-console -- Console transport intentionally uses console */
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, contextStr);
        break;
      case LogLevel.INFO:
        console.info(message, contextStr);
        break;
      case LogLevel.WARN:
        console.warn(message, contextStr);
        break;
      case LogLevel.ERROR:
        console.error(message, contextStr);
        break;
    }
    /* eslint-enable no-console */
  }

  private formatLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return colorize("[DEBUG]", "blue");
      case LogLevel.INFO:
        return colorize("[INFO] ", "green");
      case LogLevel.WARN:
        return colorize("[WARN] ", "yellow");
      case LogLevel.ERROR:
        return colorize("[ERROR]", "red");
      default:
        return "[UNKNOWN]";
    }
  }

  private formatContext(context?: Record<string, unknown>): string {
    if (!context) return "";

    // Filter out internal fields that are already in the message
    const { timestamp: _timestamp, component: _component, action: _action, ...rest } = context;

    if (Object.keys(rest).length === 0) return "";

    if (this.isDev) {
      // In development, let console.log handle pretty printing
      return JSON.stringify(rest, null, 2);
    } else {
      // In production, compact JSON
      return JSON.stringify(rest);
    }
  }
}
