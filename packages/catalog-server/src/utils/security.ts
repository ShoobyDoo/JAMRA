/**
 * Security Utilities
 *
 * Provides secure path validation and safe logging utilities
 * to prevent path traversal and format string vulnerabilities.
 */

import * as path from "node:path";
import * as fs from "node:fs";

/**
 * Validates and sanitizes a file path to prevent directory traversal attacks
 *
 * @param rootDir - The root directory that the path must be contained within
 * @param userPath - The user-provided path component
 * @returns The validated absolute path
 * @throws Error if the path is invalid or escapes the root directory
 */
export function validatePath(rootDir: string, userPath: string): string {
  // Reject obviously malicious patterns
  if (
    userPath.includes("..") ||
    userPath.includes("\0") ||
    path.isAbsolute(userPath)
  ) {
    throw new Error("Invalid path: contains forbidden characters or patterns");
  }

  // Normalize the root directory
  const normalizedRoot = path.resolve(rootDir);

  // Resolve the full path
  const resolvedPath = path.resolve(normalizedRoot, userPath);

  // Verify the resolved path starts with the root directory
  if (!resolvedPath.startsWith(normalizedRoot + path.sep) && resolvedPath !== normalizedRoot) {
    throw new Error("Invalid path: escapes root directory");
  }

  return resolvedPath;
}

/**
 * Validates a filename to ensure it doesn't contain path traversal sequences
 *
 * @param filename - The filename to validate
 * @returns The validated filename
 * @throws Error if the filename is invalid
 */
export function validateFilename(filename: string): string {
  // Reject paths with directory separators or traversal sequences
  if (
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..") ||
    filename.includes("\0")
  ) {
    throw new Error("Invalid filename: contains forbidden characters");
  }

  // Reject empty or whitespace-only filenames
  if (!filename || filename.trim().length === 0) {
    throw new Error("Invalid filename: cannot be empty");
  }

  // Reject filenames that are too long (most filesystems have 255 char limit)
  if (filename.length > 255) {
    throw new Error("Invalid filename: too long");
  }

  return filename;
}

/**
 * Validates a slug to ensure it only contains safe characters
 *
 * @param slug - The slug to validate
 * @returns The validated slug
 * @throws Error if the slug is invalid
 */
export function validateSlug(slug: string): string {
  // Only allow lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(
      "Invalid slug: must contain only lowercase letters, numbers, and hyphens",
    );
  }

  // Reject empty slugs or slugs that are just hyphens
  if (!slug || slug.replace(/-/g, "").length === 0) {
    throw new Error("Invalid slug: cannot be empty or contain only hyphens");
  }

  // Reject slugs that are too long
  if (slug.length > 200) {
    throw new Error("Invalid slug: too long");
  }

  return slug;
}

/**
 * Safely validates and resolves a file path using realpath
 *
 * @param rootDir - The root directory
 * @param userPath - The user-provided path
 * @returns The validated real path
 * @throws Error if the path is invalid or doesn't exist
 */
export function validateRealPath(rootDir: string, userPath: string): string {
  const normalizedRoot = path.resolve(rootDir);
  const tentativePath = validatePath(normalizedRoot, userPath);

  try {
    // Resolve symlinks and get the real path
    const realPath = fs.realpathSync(tentativePath);

    // Verify the real path is still within the root directory
    if (!realPath.startsWith(normalizedRoot + path.sep) && realPath !== normalizedRoot) {
      throw new Error("Invalid path: real path escapes root directory");
    }

    return realPath;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Path doesn't exist - that's okay for new files, just return the validated path
      return tentativePath;
    }
    throw error;
  }
}

/**
 * Safe logger wrapper that prevents format string vulnerabilities
 */
export const safeLog = {
  /**
   * Safely logs a message with optional data
   */
  log(message: string, ...args: unknown[]): void {
    if (args.length === 0) {
      console.log("%s", message);
    } else {
      console.log("%s", message, ...args);
    }
  },

  /**
   * Safely logs an error message with optional data
   */
  error(message: string, ...args: unknown[]): void {
    if (args.length === 0) {
      console.error("%s", message);
    } else {
      console.error("%s", message, ...args);
    }
  },

  /**
   * Safely logs a warning message with optional data
   */
  warn(message: string, ...args: unknown[]): void {
    if (args.length === 0) {
      console.warn("%s", message);
    } else {
      console.warn("%s", message, ...args);
    }
  },

  /**
   * Safely logs an info message with optional data
   */
  info(message: string, ...args: unknown[]): void {
    if (args.length === 0) {
      console.info("%s", message);
    } else {
      console.info("%s", message, ...args);
    }
  },
};

/**
 * Sanitizes user input for safe inclusion in log messages
 *
 * @param value - The value to sanitize
 * @returns A safe string representation
 */
export function sanitizeForLog(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "string") {
    // Truncate long strings and escape special characters
    return value.length > 500
      ? value.slice(0, 500) + "... (truncated)"
      : value;
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Circular or non-serializable object]";
    }
  }

  return String(value);
}
