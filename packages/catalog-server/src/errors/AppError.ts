/**
 * Base application error class with HTTP status code support
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly cause?: Error | unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      ...(this.cause instanceof Error && {
        cause: this.cause.message,
      }),
    };
  }
}

/**
 * Extension-related errors
 */
export class ExtensionNotFoundError extends AppError {
  constructor(extensionId: string, cause?: Error) {
    super(
      `Extension ${extensionId} not found`,
      "EXTENSION_NOT_FOUND",
      404,
      cause,
    );
  }
}

export class ExtensionNotEnabledError extends AppError {
  constructor(extensionId: string, cause?: Error) {
    super(
      `Extension ${extensionId} is not enabled`,
      "EXTENSION_NOT_ENABLED",
      404,
      cause,
    );
  }
}

export class ExtensionNotInstalledError extends AppError {
  constructor(extensionId: string, cause?: Error) {
    super(
      `Extension ${extensionId} is not installed`,
      "EXTENSION_NOT_INSTALLED",
      404,
      cause,
    );
  }
}

export class ExtensionAlreadyExistsError extends AppError {
  constructor(extensionId: string, cause?: Error) {
    super(
      `Extension ${extensionId} is already installed`,
      "EXTENSION_ALREADY_EXISTS",
      409,
      cause,
    );
  }
}

export class ExtensionLoadError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, "EXTENSION_LOAD_ERROR", 500, cause);
  }
}

/**
 * Database and storage errors
 */
export class DatabaseUnavailableError extends AppError {
  constructor(cause?: Error) {
    super("Database is not available", "DATABASE_UNAVAILABLE", 503, cause);
  }
}

export class StorageUnavailableError extends AppError {
  constructor(feature: string, cause?: Error) {
    super(
      `${feature} requires persistent storage but it is not available`,
      "STORAGE_UNAVAILABLE",
      503,
      cause,
    );
  }
}

/**
 * Resource not found errors
 */
export class MangaNotFoundError extends AppError {
  constructor(mangaId: string, cause?: Error) {
    super(`Manga ${mangaId} not found`, "MANGA_NOT_FOUND", 404, cause);
  }
}

export class ChapterNotFoundError extends AppError {
  constructor(chapterId: string, cause?: Error) {
    super(`Chapter ${chapterId} not found`, "CHAPTER_NOT_FOUND", 404, cause);
  }
}

export class ResourceNotFoundError extends AppError {
  constructor(resourceType: string, resourceId: string, cause?: Error) {
    super(
      `${resourceType} ${resourceId} not found`,
      "RESOURCE_NOT_FOUND",
      404,
      cause,
    );
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields?: Record<string, string[]>,
    cause?: Error,
  ) {
    super(message, "VALIDATION_ERROR", 400, cause);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      fields: this.fields,
    };
  }
}

export class InvalidRequestError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, "INVALID_REQUEST", 400, cause);
  }
}

/**
 * Conflict errors
 */
export class ResourceConflictError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, "RESOURCE_CONFLICT", 409, cause);
  }
}

/**
 * Registry and update errors
 */
export class RegistryError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, "REGISTRY_ERROR", 500, cause);
  }
}

export class UpdateCheckError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, "UPDATE_CHECK_ERROR", 500, cause);
  }
}

/**
 * Permission and authorization errors
 */
export class ForbiddenError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, "FORBIDDEN", 403, cause);
  }
}

/**
 * Helper function to determine if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Helper function to convert any error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, "INTERNAL_ERROR", 500, error);
  }

  return new AppError(String(error), "UNKNOWN_ERROR", 500);
}
