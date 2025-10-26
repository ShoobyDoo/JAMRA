/**
 * Shared types for JAMRA logging system
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  OFF = 4,
}

export interface LogContext {
  [key: string]: unknown;
  timestamp?: string;
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
}

export interface NetworkLogContext extends LogContext {
  url?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  requestSize?: number;
  responseSize?: number;
  error?: Error;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  formattedMessage?: string;
}
