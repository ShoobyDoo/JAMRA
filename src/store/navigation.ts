import { create } from "zustand";

interface NavigationState {
  isNavigating: boolean;
  setNavigating: (isNavigating: boolean) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  isNavigating: false,
  setNavigating: (isNavigating) => set({ isNavigating }),
}));
