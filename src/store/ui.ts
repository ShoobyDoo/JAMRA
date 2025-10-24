"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { logger } from "@/lib/logger";
import { SIDEBAR_WIDTH } from "@/lib/constants";

interface UIState {
  collapsed: boolean;
  sidebarWidth: number;
  toggleCollapsed: () => void;
  setSidebarWidth: (width: number) => void;
}

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      sidebarWidth: SIDEBAR_WIDTH.EXPANDED,
      toggleCollapsed: () => {
        const shouldCollapse = !get().collapsed;
        set({ collapsed: shouldCollapse });
      },
      setSidebarWidth: (width: number) => {
        const clampedWidth = Math.max(
          MIN_SIDEBAR_WIDTH,
          Math.min(MAX_SIDEBAR_WIDTH, width),
        );
        set({ sidebarWidth: clampedWidth });
      },
    }),
    {
      name: "ui-storage", // localStorage key
      storage: createJSONStorage(() => localStorage),
      skipHydration: true, // Prevent automatic hydration to avoid SSR/CSR mismatch
      onRehydrateStorage: () => () => {
        logger.info("UI store rehydrated", {
          component: "UIStore",
          action: "rehydrate",
        });
      },
    },
  ),
);

export { MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH };
