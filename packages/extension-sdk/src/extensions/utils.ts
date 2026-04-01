import type { Manga } from "../index.js";
import { normalizeSlug } from "./slug-resolver.js";

export interface ExtractSlugOptions {
  baseUrl?: string;
  allowNumeric?: boolean;
}

const ensureTrailingSlash = (value: string): string => {
  return value.endsWith("/") ? value : `${value}/`;
};

export const toAbsoluteUrl = (value: string, baseUrl: string): string => {
  try {
    const url = new URL(value, ensureTrailingSlash(baseUrl));
    return url.toString();
  } catch {
    return value;
  }
};

export const runLimited = async <T>(
  items: Iterable<T>,
  limit: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> => {
  const max = Math.max(1, limit);
  const executing = new Set<Promise<void>>();
  let index = 0;
  for (const item of items) {
    const promise = task(item, index++).finally(() => {
      executing.delete(promise);
    });
    executing.add(promise);
    if (executing.size >= max) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
};

export const extractSlugFromUrl = (
  value: string,
  options?: ExtractSlugOptions,
): string | undefined => {
  const allowNumeric = options?.allowNumeric ?? false;
  try {
    const base = options?.baseUrl ? ensureTrailingSlash(options.baseUrl) : undefined;
    const url = base ? new URL(value, base) : new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments.at(-1);
    if (!last) {
      return undefined;
    }
    if (!allowNumeric && /^\d+$/.test(last)) {
      return undefined;
    }
    return normalizeSlug(decodeURIComponent(last));
  } catch {
    return undefined;
  }
};

export const normalizeStatusValue = (
  value: string | undefined,
): Manga["status"] | undefined => {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "ongoing":
      return "ongoing";
    case "complete":
    case "completed":
      return "completed";
    case "hiatus":
      return "hiatus";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return undefined;
  }
};

export const extractChapterNumber = (title: string): number | undefined => {
  const match = title.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return undefined;
  }
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : undefined;
};
