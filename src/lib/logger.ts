/**
 * Logging utility for JAMRA application
 * Provides verbose debugging information in development mode only
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

class Logger {
  private isDev = process.env.NODE_ENV === "development";
  private minLevel: LogLevel = this.isDev ? LogLevel.DEBUG : LogLevel.INFO;

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  // Configuration methods
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

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const component = context?.component ? `[${context.component}]` : "";
    const action = context?.action ? `(${context.action})` : "";

    return `${timestamp} ${levelName} ${component}${action} ${message}`;
  }

  private formatNetworkMessage(
    level: LogLevel,
    message: string,
    context?: NetworkLogContext,
  ): string {
    const baseMessage = this.formatMessage(level, message, context);

    if (!context) return baseMessage;

    const networkDetails: string[] = [];

    if (context.url) networkDetails.push(`URL: ${context.url}`);
    if (context.method) networkDetails.push(`Method: ${context.method}`);
    if (context.statusCode)
      networkDetails.push(`Status: ${context.statusCode}`);
    if (context.duration !== undefined)
      networkDetails.push(`Duration: ${context.duration}ms`);
    if (context.requestSize !== undefined)
      networkDetails.push(`Req Size: ${context.requestSize}B`);
    if (context.responseSize !== undefined)
      networkDetails.push(`Res Size: ${context.responseSize}B`);

    if (networkDetails.length > 0) {
      return `${baseMessage} | ${networkDetails.join(" | ")}`;
    }

    return baseMessage;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, context);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, context);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, context);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, context);
        break;
    }
  }

  private logNetwork(
    level: LogLevel,
    message: string,
    context?: NetworkLogContext,
  ): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatNetworkMessage(level, message, context);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, context);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, context);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, context);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, context);
        break;
    }
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
}

// Create and export a singleton logger instance
export const logger = new Logger();

// Export the class for testing or custom instances
export { Logger };
