import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      toggleCollapsed: () => {
        const shouldCollapse = !get().collapsed;
        set({ collapsed: shouldCollapse });
      },
    }),
    {
      name: "ui-storage", // localStorage key
    },
  ),
);
