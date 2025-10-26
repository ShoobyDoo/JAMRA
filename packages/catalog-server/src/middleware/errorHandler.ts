import type { Request, Response, NextFunction } from "express";
import { toAppError } from "../errors/AppError.js";

/**
 * Express error handling middleware
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const appError = toAppError(error);

  // Log error details (using format string to prevent injection)
  console.error("[%s] %s", appError.code, appError.message, {
    path: req.path,
    method: req.method,
    ...(appError.cause instanceof Error && { cause: appError.cause.message }),
    ...(appError.cause instanceof Error &&
      appError.cause.stack && { stack: appError.cause.stack }),
  });

  // Send error response
  res.status(appError.httpStatus).json({
    error: appError.message,
    code: appError.code,
    ...(process.env.NODE_ENV !== "production" &&
      appError.cause instanceof Error && {
        detail: appError.cause.message,
        stack: appError.cause.stack,
      }),
  });
}

/**
 * Helper function for inline error handling in route handlers
 */
export function handleError(
  res: Response,
  error: unknown,
  fallbackMessage = "An error occurred",
) {
  const appError = toAppError(error);

  // Override message if error is generic
  if (appError.code === "INTERNAL_ERROR" || appError.code === "UNKNOWN_ERROR") {
    appError.message = fallbackMessage;
  }

  const detail =
    appError.cause instanceof Error
      ? appError.cause.message
      : String(appError.cause);

  console.error("%s %s", fallbackMessage, detail);
  if (appError.cause instanceof Error && appError.cause.stack) {
    console.error("Stack trace: %s", appError.cause.stack);
  }

  // Build response object
  const responseBody: Record<string, unknown> = {
    error: appError.message,
    code: appError.code,
    ...(detail && { detail }),
  };

  // Include validation fields if present
  if (
    "fields" in appError &&
    appError.fields &&
    typeof appError.fields === "object"
  ) {
    responseBody.fields = appError.fields;
  }

  res.status(appError.httpStatus).json(responseBody);
}
