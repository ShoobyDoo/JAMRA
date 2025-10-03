"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/routes";

const sidebarPaths = routes
  .filter((route) => route.inSidebar)
  .map((route) => route.path);

const apiWarmupTargets = ["/api/health", "/api/catalog?page=1", "/api/filters"];

export function AppWarmup(): null {
  const router = useRouter();

  useEffect(() => {
    sidebarPaths.forEach((path) => {
      void Promise.resolve(router.prefetch(path)).catch(() => undefined);
    });

    const controller = new AbortController();
    const { signal } = controller;

    apiWarmupTargets.forEach((target) => {
      void fetch(target, { signal }).catch(() => undefined);
    });

    return () => {
      controller.abort();
    };
  }, [router]);

  return null;
}
