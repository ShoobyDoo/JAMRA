"use client";

import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

interface PerformanceOptions {
  detail?: Record<string, unknown>;
}

export function usePerformanceMonitor(
  label: string,
  { detail }: PerformanceOptions = {},
): void {
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof performance === "undefined") {
      return;
    }

    startRef.current = performance.now();

    const paintHandle = requestAnimationFrame(() => {
      if (startRef.current === null) return;
      const duration = performance.now() - startRef.current;
      logger.debug("Component paint", {
        component: label,
        durationMs: duration,
        ...detail,
      });
    });

    return () => {
      cancelAnimationFrame(paintHandle);
      if (startRef.current !== null) {
        const total = performance.now() - startRef.current;
        logger.debug("Component unmounted", {
          component: label,
          durationMs: total,
          ...detail,
        });
      }
    };
  }, [label, detail]);
}
