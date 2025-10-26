/**
 * Request Helper Utilities
 *
 * Utility functions for handling Express requests
 */

import type { Request, Response } from "express";
import { ValidationError } from "../errors/AppError.js";

/**
 * Safely extract a query parameter as a string
 */
export function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

/**
 * Coerce settings payload to proper type
 */
export function coerceSettings(
  payload: unknown,
): Record<string, unknown> | null | undefined {
  if (payload === undefined) return undefined;
  if (payload === null) return null;
  if (typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new Error("Invalid settings payload; expected an object or null.");
}

/**
 * Validate request body using a schema (typically Zod)
 */
export function validateRequestBody<T>(
  schema: { parse: (data: unknown) => T },
  data: unknown,
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error && typeof error === "object" && "errors" in error) {
      const zodError = error as {
        errors: Array<{ path: (string | number)[]; message: string }>;
      };
      const fields: Record<string, string[]> = {};
      for (const err of zodError.errors) {
        const key = err.path.join(".");
        if (!fields[key]) fields[key] = [];
        fields[key].push(err.message);
      }
      throw new ValidationError("Invalid request body", fields);
    }
    throw new ValidationError("Invalid request body");
  }
}

/**
 * Resolve extension ID from request or use the active one
 */
export function resolveExtensionId(
  req: Request,
  activeExtensionId?: string,
): string | undefined {
  const requested = getQueryParam(req, "extensionId")?.trim();
  if (requested) {
    return requested;
  }
  return activeExtensionId;
}

/**
 * Ensure an extension is loaded, returning the ID or sending error response
 */
export function ensureExtensionLoaded(
  req: Request,
  res: Response,
  host: { isLoaded: (id: string) => boolean },
  activeExtensionId?: string,
): string | undefined {
  const extensionId = resolveExtensionId(req, activeExtensionId);
  if (!extensionId) {
    res.status(404).json({ error: "No extensions are enabled." });
    return undefined;
  }
  if (!host.isLoaded(extensionId)) {
    res
      .status(404)
      .json({ error: `Extension ${extensionId} is not enabled.` });
    return undefined;
  }
  return extensionId;
}
