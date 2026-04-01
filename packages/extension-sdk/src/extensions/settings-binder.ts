import type { ExtensionSettingsValues } from "../index.js";

interface SettingRecord {
  type: "number" | "string" | "boolean" | "unknown";
  value: unknown;
}

export interface NumberSettingOptions {
  default?: number;
  min?: number;
  max?: number;
  integer?: boolean;
}

export interface StringSettingOptions {
  default?: string;
  normalize?: (value: string) => string | undefined;
  allowEmpty?: boolean;
}

export interface BooleanSettingOptions {
  default?: boolean;
  truthy?: Array<string | number>;
  falsy?: Array<string | number>;
}

export interface SettingsAccessors {
  getValue<T = unknown>(key: string): T | undefined;
  getNumber(key: string): number | undefined;
  getString(key: string): string | undefined;
  getBoolean(key: string): boolean | undefined;
  raw(): ExtensionSettingsValues;
}

export class SettingsBinder {
  private readonly resolved = new Map<string, SettingRecord>();

  private constructor(private readonly source: ExtensionSettingsValues) {}

  static from(values: ExtensionSettingsValues): SettingsBinder {
    return new SettingsBinder(values ?? {});
  }

  number(key: string, options?: NumberSettingOptions): this {
    const value = resolveNumber(this.source[key], options);
    this.resolved.set(key, { type: "number", value });
    return this;
  }

  string(key: string, options?: StringSettingOptions): this {
    const value = resolveString(this.source[key], options);
    this.resolved.set(key, { type: "string", value });
    return this;
  }

  boolean(key: string, options?: BooleanSettingOptions): this {
    const value = resolveBoolean(this.source[key], options);
    this.resolved.set(key, { type: "boolean", value });
    return this;
  }

  withOverride(
    key: string,
    override: (current: unknown) => unknown,
  ): this {
    const current = this.resolved.get(key)?.value ?? this.source[key];
    const value = override(current);
    this.resolved.set(key, {
      type: inferType(value),
      value,
    });
    return this;
  }

  result(): SettingsAccessors {
    const snapshot = new Map(this.resolved);
    const raw = { ...this.source };
    return {
      getValue: <T = unknown>(key: string): T | undefined => {
        if (snapshot.has(key)) {
          return snapshot.get(key)?.value as T | undefined;
        }
        return raw[key] as T | undefined;
      },
      getNumber: (key) => {
        const value = snapshot.has(key)
          ? snapshot.get(key)?.value
          : resolveNumber(raw[key], undefined);
        return typeof value === "number" && Number.isFinite(value)
          ? value
          : undefined;
      },
      getString: (key) => {
        const value = snapshot.has(key)
          ? snapshot.get(key)?.value
          : resolveString(raw[key], undefined);
        return typeof value === "string" && value.length > 0
          ? value
          : undefined;
      },
      getBoolean: (key) => {
        const value = snapshot.has(key)
          ? snapshot.get(key)?.value
          : resolveBoolean(raw[key], undefined);
        return typeof value === "boolean" ? value : undefined;
      },
      raw: () => raw,
    };
  }
}

const resolveNumber = (
  raw: unknown,
  options?: NumberSettingOptions,
): number | undefined => {
  let value: number | undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    value = raw;
  } else if (typeof raw === "string") {
    const parsed = Number.parseFloat(raw);
    value = Number.isFinite(parsed) ? parsed : undefined;
  }

  if (value === undefined) {
    value = options?.default;
  }

  if (value === undefined) {
    return undefined;
  }

  if (options?.integer) {
    value = Math.trunc(value);
  }

  if (typeof options?.min === "number") {
    value = Math.max(options.min, value);
  }
  if (typeof options?.max === "number") {
    value = Math.min(options.max, value);
  }

  return value;
};

const resolveString = (
  raw: unknown,
  options?: StringSettingOptions,
): string | undefined => {
  if (typeof raw !== "string") {
    return options?.default;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 && !options?.allowEmpty) {
    return options?.default;
  }
  const normalized = options?.normalize ? options.normalize(trimmed) : trimmed;
  if (normalized === undefined || normalized.length === 0) {
    return options?.default;
  }
  return normalized;
};

const resolveBoolean = (
  raw: unknown,
  options?: BooleanSettingOptions,
): boolean | undefined => {
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "number") {
    if (raw === 1) {
      return true;
    }
    if (raw === 0) {
      return false;
    }
  }
  if (typeof raw === "string") {
    const value = raw.trim().toLowerCase();
    if (value === "true" || value === "1") {
      return true;
    }
    if (value === "false" || value === "0") {
      return false;
    }
  }
  if (options?.truthy?.some((candidate) => candidate === raw)) {
    return true;
  }
  if (options?.falsy?.some((candidate) => candidate === raw)) {
    return false;
  }
  return options?.default;
};

const inferType = (value: unknown): SettingRecord["type"] => {
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  return "unknown";
};
