# JAMRA Code Standards

This document outlines the coding standards and best practices for the JAMRA project. These standards ensure consistency, maintainability, and quality across the codebase.

## Table of Contents

- [General Principles](#general-principles)
- [TypeScript](#typescript)
- [React & Next.js](#react--nextjs)
- [Styling & UI](#styling--ui)
- [Error Handling](#error-handling)
- [Logging](#logging)
- [Database](#database)
- [Testing](#testing)

---

## General Principles

### Code Quality

- **Write clear, self-documenting code** with meaningful variable and function names
- **Keep functions small and focused** - each function should do one thing well
- **Avoid premature optimization** - prioritize clarity first, optimize when necessary
- **Follow the DRY principle** (Don't Repeat Yourself)
- **Remove dead code** - don't comment out code, use version control instead

### Module System

- **Always use ES6 imports** - never use `require()` (CommonJS)
  ```typescript
  // ✅ Good
  import { something } from "./module";

  // ❌ Bad
  const something = require("./module");
  ```

- **Use named imports** when importing multiple items
  ```typescript
  // ✅ Good
  import { Button, Stack, Text } from "@mantine/core";

  // ❌ Avoid
  import Button from "@mantine/core/Button";
  import Stack from "@mantine/core/Stack";
  ```

---

## TypeScript

### Type Safety

- **Avoid `any` types** - use `unknown` when the type is truly unknown, then narrow it
  ```typescript
  // ✅ Good
  function process(data: unknown) {
    if (typeof data === "string") {
      return data.toUpperCase();
    }
  }

  // ❌ Bad
  function process(data: any) {
    return data.toUpperCase();
  }
  ```

- **Use strict null checks** - explicitly handle `null` and `undefined`
- **Validate external data** - never trust data from APIs, databases, or user input without validation

### Type Assertions

- **Avoid blind type assertions** - validate data before asserting types
  ```typescript
  // ✅ Good
  const row = stmt.get({ id });
  if (!row) return undefined;
  return validateDatabaseRow<ExtensionRow>(row, EXTENSION_ROW_SCHEMA);

  // ❌ Bad
  return stmt.get({ id }) as ExtensionRow | undefined;
  ```

- **Use type predicates** for validation functions
  ```typescript
  function isError(value: unknown): value is Error {
    return value instanceof Error;
  }
  ```

### Interfaces vs Types

- **Use interfaces** for object shapes that may be extended
- **Use types** for unions, intersections, and mapped types
  ```typescript
  // ✅ Interfaces for objects
  interface User {
    id: string;
    name: string;
  }

  // ✅ Types for unions
  type Status = "pending" | "success" | "error";
  ```

---

## React & Next.js

### Component Structure

- **Prefer function components** over class components
- **Use TypeScript interfaces** for props
- **Keep components focused** - break large components into smaller ones

  ```typescript
  interface ButtonProps {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  }

  export function Button({ label, onClick, variant = "primary" }: ButtonProps) {
    return <button onClick={onClick}>{label}</button>;
  }
  ```

### State Management

- **Consolidate related state** - use a single state object instead of multiple `useState` calls
  ```typescript
  // ✅ Good - consolidated state
  interface FormState {
    email: string;
    password: string;
    loading: boolean;
    error: string | null;
  }

  const [state, setState] = useState<FormState>({
    email: "",
    password: "",
    loading: false,
    error: null,
  });

  // ❌ Bad - fragmented state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  ```

- **Use Zustand for global state** - documented in `/src/store/`
- **Use React Query/SWR for server state** - avoid duplicating server data in global state

### Hooks

- **Use `useCallback` for event handlers** passed to child components
- **Use `useMemo` for expensive computations** - not for every derived value
- **Add cleanup in `useEffect`** - always return a cleanup function when needed
  ```typescript
  useEffect(() => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 10000);

    fetchData(abortController.signal);

    return () => {
      clearTimeout(timeout);
      abortController.abort();
    };
  }, []);
  ```

### Error Boundaries

- **Use error.tsx files** for route-level error boundaries
- **Use logger for error tracking** - never use `console.error` except in global-error.tsx
  ```typescript
  useEffect(() => {
    logger.error("Component error", {
      component: "MyComponent",
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }, [error]);
  ```

---

## Styling & UI

### Tailwind CSS

- **Use theme tokens** instead of arbitrary values whenever possible
  ```typescript
  // ✅ Good - using theme colors
  className="bg-mantine-red-6 border-mantine-red-0"

  // ❌ Bad - arbitrary values when theme exists
  className="bg-[var(--mantine-color-red-6)]"
  ```

- **Use Mantine spacing scale** - `xs`, `sm`, `md`, `lg`, `xl`
  ```typescript
  // ✅ Good
  <Stack gap="md" />

  // ✅ Also good with Tailwind
  className="p-md gap-lg"
  ```

- **Group related classes** for readability
  ```typescript
  className={cn(
    // Layout
    "flex items-center justify-between",
    // Spacing
    "p-4 gap-2",
    // Colors
    "bg-background text-foreground",
    // State
    isActive && "border-blue-500"
  )}
  ```

### Component Libraries

- **Use Mantine for complex UI** - forms, modals, dropdowns, etc.
- **Use Tailwind for layout** - flexbox, grid, spacing
- **Use `cn()` utility** for conditional classes
  ```typescript
  import { cn } from "@/lib/utils";

  className={cn(
    "base-class",
    condition && "conditional-class",
    props.className
  )}
  ```

---

## Error Handling

### Client-Side Errors

- **Always catch async errors** - never let promises reject silently
  ```typescript
  // ✅ Good
  try {
    await fetchData();
  } catch (error) {
    logger.error("Failed to fetch data", {
      component: "MyComponent",
      action: "fetch-data",
      error: error instanceof Error ? error : new Error(String(error)),
    });
    // Handle error appropriately
  }
  ```

- **Use AbortController** for cancelable async operations
- **Add timeout protection** for network requests
  ```typescript
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10000);

  try {
    await fetch(url, { signal: abortController.signal });
  } finally {
    clearTimeout(timeout);
  }
  ```

### Server-Side Errors

- **Use structured error responses** with proper HTTP status codes
- **Log errors with context** - include request details, user info (if available)
- **Never expose internal errors** to clients - return sanitized error messages

---

## Logging

### Logging Infrastructure

JAMRA uses a multi-transport logging system supporting console, file, and browser storage.

### Usage Guidelines

- **Never use console.* directly** (except in `global-error.tsx`)
  ```typescript
  // ✅ Good
  import { logger } from "@/lib/logger";
  logger.info("User logged in", { userId, timestamp });

  // ❌ Bad
  console.log("User logged in", userId);
  ```

- **Include structured context** in log messages
  ```typescript
  logger.error("Database query failed", {
    component: "UserRepository",
    action: "find-user",
    userId: id,
    error: error,
  });
  ```

- **Use appropriate log levels**:
  - `DEBUG`: Detailed information for debugging
  - `INFO`: General informational messages
  - `WARN`: Warning messages for recoverable issues
  - `ERROR`: Error messages for failures

### Extension Logging

- **Use logger from context** in extensions
  ```typescript
  export async function searchManga(
    query: string,
    context: ExtensionContext
  ): Promise<MangaSummary[]> {
    context.logger.debug("Searching manga", { query });
    // ...
  }
  ```

### Log Files

- **Location**: `.jamra-data/logs/`
- **Main process**: `main.log`, `error.log`
- **Extensions**: `ext-{extensionId}.log`
- **Rotation**: Automatic at 10MB, keeps 5 backups

---

## Database

### Type Safety

- **Validate database rows** at runtime - never blindly assert types
  ```typescript
  // ✅ Good
  const rows = validateDatabaseRows<ExtensionRow>(
    stmt.all(),
    EXTENSION_ROW_SCHEMA
  );

  // ❌ Bad
  const rows = stmt.all() as ExtensionRow[];
  ```

- **Define schemas** for all database row types
  ```typescript
  const EXTENSION_ROW_SCHEMA = {
    name: "ExtensionRow",
    requiredKeys: ["id", "name", "version"],
    fields: {
      id: { type: "string", nullable: false },
      name: { type: "string", nullable: false },
      version: { type: "string", nullable: false },
    },
  } as const;
  ```

### Queries

- **Use parameterized queries** - never string concatenation
  ```typescript
  // ✅ Good
  const stmt = db.prepare("SELECT * FROM users WHERE id = @id");
  stmt.get({ id: userId });

  // ❌ Bad - SQL injection risk
  db.prepare(`SELECT * FROM users WHERE id = '${userId}'`);
  ```

- **Use transactions** for related operations
- **Handle null values explicitly** - don't assume columns are non-null

---

## Testing

### Unit Tests

- **Test business logic** - keep tests focused on behavior, not implementation
- **Use descriptive test names** that explain what is being tested
- **Follow AAA pattern**: Arrange, Act, Assert
  ```typescript
  test("validates email format correctly", () => {
    // Arrange
    const email = "user@example.com";

    // Act
    const result = validateEmail(email);

    // Assert
    expect(result).toBe(true);
  });
  ```

### Integration Tests

- **Test critical user flows** end-to-end
- **Use test databases** - never test against production data
- **Clean up after tests** - ensure tests don't leave side effects

---

## Additional Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React Documentation](https://react.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Mantine Documentation](https://mantine.dev/)

---

**Last Updated**: 2025-10-25

This document is a living guide. If you discover new patterns or best practices, please update this document through a pull request.
