/**
 * Lightweight runtime validators for database row types
 * Ensures that type assertions match actual runtime data
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validates that a value is a non-null object
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates that an object has all required keys
 */
function hasRequiredKeys(
  obj: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return keys.every((key) => key in obj);
}

/**
 * Validates that a value matches the expected type
 */
function validateType(
  value: unknown,
  expectedType: "string" | "number" | "boolean",
  nullable: boolean,
  fieldName: string,
): void {
  if (nullable && (value === null || value === undefined)) {
    return;
  }

  if (typeof value !== expectedType) {
    throw new ValidationError(
      `Field "${fieldName}" expected ${expectedType}${nullable ? " | null" : ""}, got ${typeof value}`,
    );
  }
}

/**
 * Validates database rows against expected schema
 */
export function validateDatabaseRow<T extends Record<string, unknown>>(
  row: unknown,
  schema: {
    name: string;
    requiredKeys: readonly string[];
    fields: Record<
      string,
      { type: "string" | "number" | "boolean"; nullable: boolean }
    >;
  },
): T {
  if (!isObject(row)) {
    throw new ValidationError(`${schema.name}: Expected object, got ${typeof row}`);
  }

  if (!hasRequiredKeys(row, schema.requiredKeys)) {
    const missing = schema.requiredKeys.filter((key) => !(key in row));
    throw new ValidationError(
      `${schema.name}: Missing required fields: ${missing.join(", ")}`,
    );
  }

  // Validate each field type
  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    validateType(
      row[fieldName],
      fieldSchema.type,
      fieldSchema.nullable,
      `${schema.name}.${fieldName}`,
    );
  }

  return row as T;
}

/**
 * Validates an array of database rows
 */
export function validateDatabaseRows<T extends Record<string, unknown>>(
  rows: unknown,
  schema: Parameters<typeof validateDatabaseRow<T>>[1],
): T[] {
  if (!Array.isArray(rows)) {
    throw new ValidationError(`Expected array of ${schema.name}, got ${typeof rows}`);
  }

  return rows.map((row, index) => {
    try {
      return validateDatabaseRow<T>(row, schema);
    } catch (error) {
      throw new ValidationError(
        `${schema.name}[${index}]: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
}
