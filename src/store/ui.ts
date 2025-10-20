import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { SIDEBAR_WIDTH } from "@/lib/constants";

interface UIState {
  collapsed: boolean;
  sidebarWidth: number;
  _hasHydrated: boolean;
  toggleCollapsed: () => void;
  setSidebarWidth: (width: number) => void;
  setHasHydrated: (state: boolean) => void;
}

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      sidebarWidth: SIDEBAR_WIDTH.EXPANDED,
      _hasHydrated: false,
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
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: "ui-storage", // localStorage key
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export { MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH };
