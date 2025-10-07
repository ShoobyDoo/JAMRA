"use client";

import { useNavigationStore } from "@/store/navigation";
import { Loader } from "@mantine/core";

interface GlobalLoadingOverlayProps {
  scope?: "viewport" | "content";
}

export function GlobalLoadingOverlay({ scope = "viewport" }: GlobalLoadingOverlayProps) {
  const isNavigating = useNavigationStore((state) => state.isNavigating);

  if (!isNavigating) return null;

  const positioningClass =
    scope === "content" ? "absolute inset-0" : "fixed inset-0";

  return (
    <div
      className={`${positioningClass} z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm`}
    >
      <Loader size="lg" />
    </div>
  );
}
