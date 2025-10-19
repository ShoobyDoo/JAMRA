import type { Request, Response, NextFunction } from "express";
import { toAppError } from "../errors/AppError.js";

/**
 * Express error handling middleware
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  const appError = toAppError(error);

  // Log error details
  console.error(`[${appError.code}] ${appError.message}`, {
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

  console.error(fallbackMessage, detail);
  if (appError.cause instanceof Error && appError.cause.stack) {
    console.error("Stack trace:", appError.cause.stack);
  }

  res.status(appError.httpStatus).json({
    error: appError.message,
    code: appError.code,
    ...(detail && { detail }),
  });
}
