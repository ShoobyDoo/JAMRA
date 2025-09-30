import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility to conditionally join class names
 * with Tailwind-aware merging.
 *
 * Example:
 *   cn("p-2", isActive && "bg-red-500")
 */
export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}
