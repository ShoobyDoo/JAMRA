import { z } from "zod";

/**
 * Reading Progress Validation
 */
export const ReadingProgressSchema = z.object({
  mangaId: z.string().min(1).max(255),
  chapterId: z.string().min(1).max(255),
  currentPage: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
  scrollPosition: z.number().nonnegative().optional(),
});

export type ReadingProgressInput = z.infer<typeof ReadingProgressSchema>;

/**
 * Library Entry Validation
 */
export const LibraryStatusSchema = z.enum([
  "reading",
  "plan_to_read",
  "completed",
  "on_hold",
  "dropped",
]);

export const AddToLibrarySchema = z.object({
  mangaId: z.string().min(1).max(255),
  extensionId: z.string().min(1).max(255),
  status: LibraryStatusSchema,
  personalRating: z.number().int().min(0).max(10).optional(),
  favorite: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
  startedAt: z.number().int().positive().optional(),
  completedAt: z.number().int().positive().optional(),
});

export const UpdateLibraryEntrySchema = z.object({
  status: LibraryStatusSchema.optional(),
  personalRating: z.number().int().min(0).max(10).nullable().optional(),
  favorite: z.boolean().optional(),
  notes: z.string().max(5000).nullable().optional(),
  startedAt: z.number().int().positive().nullable().optional(),
  completedAt: z.number().int().positive().nullable().optional(),
});

export type AddToLibraryInput = z.infer<typeof AddToLibrarySchema>;
export type UpdateLibraryEntryInput = z.infer<typeof UpdateLibraryEntrySchema>;

/**
 * History Entry Validation
 */
export const HistoryEntrySchema = z.object({
  mangaId: z.string().min(1).max(255),
  chapterId: z.string().min(1).max(255).optional(),
  actionType: z.string().min(1).max(50),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type HistoryEntryInput = z.infer<typeof HistoryEntrySchema>;

/**
 * Cover Report Validation
 */
export const CoverReportSchema = z.object({
  url: z.string().url(),
  status: z.enum(["success", "failure"]),
  attemptedUrls: z.array(z.string().url()).optional(),
});

export type CoverReportInput = z.infer<typeof CoverReportSchema>;

/**
 * Extension Settings Validation
 */
export const ExtensionSettingsSchema = z.record(z.string(), z.unknown()).nullable();

export type ExtensionSettingsInput = z.infer<typeof ExtensionSettingsSchema>;

/**
 * Library Tag Validation
 */
export const CreateLibraryTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export type CreateLibraryTagInput = z.infer<typeof CreateLibraryTagSchema>;

/**
 * Query Parameter Validation
 */
export const PaginationSchema = z.object({
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
});

export const HistoryQuerySchema = PaginationSchema.extend({
  mangaId: z.string().optional(),
  actionType: z.string().optional(),
  startDate: z.number().int().positive().optional(),
  endDate: z.number().int().positive().optional(),
  enriched: z.enum(["true", "false"]).optional(),
});

export type HistoryQueryInput = z.infer<typeof HistoryQuerySchema>;

/**
 * Helper function to validate and parse request body
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Helper function to validate and parse query parameters
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  data: Record<string, string | undefined>,
): { success: true; data: T } | { success: false; error: z.ZodError } {
  // Convert string query params to appropriate types
  const converted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    // Try to parse as number
    const num = Number(value);
    if (!Number.isNaN(num) && value !== "") {
      converted[key] = num;
      continue;
    }

    // Keep as string
    converted[key] = value;
  }

  const result = schema.safeParse(converted);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
