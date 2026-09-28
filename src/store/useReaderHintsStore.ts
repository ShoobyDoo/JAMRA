import { create } from "zustand";

let sessionHotzoneHintShown = false;

interface ReaderHintsState {
  hasShownSessionHint: boolean;
  markSessionHintShown: () => void;
}

export const useReaderHints = create<ReaderHintsState>((set) => ({
  hasShownSessionHint: sessionHotzoneHintShown,
  markSessionHintShown: () => {
    if (sessionHotzoneHintShown) {
      return;
    }
    sessionHotzoneHintShown = true;
    set({ hasShownSessionHint: true });
  },
}));
