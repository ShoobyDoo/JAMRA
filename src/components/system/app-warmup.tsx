"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { notifications } from "@mantine/notifications";
import { routes } from "@/lib/routes";
import { logger } from "@/lib/logger";

const sidebarPaths = routes
  .filter((route) => route.inSidebar)
  .map((route) => route.path);

const apiWarmupTargets = ["/api/health", "/api/catalog?page=1", "/api/filters"];

export function AppWarmup(): null {
  const router = useRouter();

  useEffect(() => {
    logger.componentMount("AppWarmup", {
      component: "AppWarmup",
      action: "warmup-start",
    });

    logger.debug("Starting application warmup", {
      component: "AppWarmup",
      action: "warmup-start",
      sidebarPathsCount: sidebarPaths.length,
      apiTargetsCount: apiWarmupTargets.length,
    });

    sidebarPaths.forEach((path) => {
      void Promise.resolve(router.prefetch(path)).catch(() => undefined);
      logger.debug(`Prefetching route: ${path}`, {
        component: "AppWarmup",
        action: "route-prefetch",
        path,
      });
    });

    const controller = new AbortController();
    const { signal } = controller;

    let failedCount = 0;
    const totalTargets = apiWarmupTargets.length;

    apiWarmupTargets.forEach((target) => {
      void fetch(target, { signal })
        .then(() => {
          logger.debug(`API warmup successful: ${target}`, {
            component: "AppWarmup",
            action: "api-warmup-success",
            target,
          });
        })
        .catch((error) => {
          logger.warn(`API warmup failed: ${target}`, {
            component: "AppWarmup",
            action: "api-warmup-error",
            target,
            error,
          });

          failedCount++;

          // Show notification if all API warmup calls fail
          if (failedCount === totalTargets) {
            notifications.show({
              title: "API Connection Issue",
              message:
                "Could not connect to the API server. Some features may not work properly.",
              color: "yellow",
              autoClose: 5000,
            });
          }
        });
    });

    return () => {
      logger.componentUnmount("AppWarmup", {
        component: "AppWarmup",
        action: "warmup-cleanup",
      });
      controller.abort();
    };
  }, [router]);

  return null;
}
