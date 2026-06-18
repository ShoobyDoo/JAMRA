import { useCallback, useEffect } from "react";
import {
  useReaderSettings,
  type ReadingMode,
} from "../../../store/useReaderSettingsStore";

export interface NavigationCallbacks {
  onNextPage: () => void;
  onPrevPage: () => void;
  onFirstPage: () => void;
  onLastPage: () => void;
  onToggleZenMode: () => void;
  onToggleSettings: () => void;
  onCycleModes: () => void;
  onExitReader?: () => void;
}

const READING_MODES: ReadingMode[] = [
  "paged-ltr",
  "paged-rtl",
  "dual-page",
  "vertical",
];

export const useReaderNavigation = (callbacks: NavigationCallbacks) => {
  const { readingMode, setReadingMode, toggleZenMode } = useReaderSettings();

  const cycleModes = useCallback(() => {
    const currentIndex = READING_MODES.indexOf(readingMode);
    const nextIndex = (currentIndex + 1) % READING_MODES.length;
    setReadingMode(READING_MODES[nextIndex]);
  }, [readingMode, setReadingMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const { key, shiftKey, ctrlKey, metaKey } = e;

      const shouldPreventDefault = [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        " ",
        "Home",
        "End",
      ].includes(key);

      if (shouldPreventDefault && !ctrlKey && !metaKey) {
        e.preventDefault();
      }

      switch (key) {
        case "ArrowRight":
          if (readingMode === "paged-rtl") {
            callbacks.onPrevPage();
          } else {
            callbacks.onNextPage();
          }
          break;

        case "ArrowLeft":
          if (readingMode === "paged-rtl") {
            callbacks.onNextPage();
          } else {
            callbacks.onPrevPage();
          }
          break;

        case "ArrowDown":
          if (readingMode !== "vertical") {
            callbacks.onNextPage();
          }
          break;

        case "ArrowUp":
          if (readingMode !== "vertical") {
            callbacks.onPrevPage();
          }
          break;

        case " ":
          if (shiftKey) {
            callbacks.onPrevPage();
          } else {
            callbacks.onNextPage();
          }
          break;

        case "Home":
          callbacks.onFirstPage();
          break;

        case "End":
          callbacks.onLastPage();
          break;

        case "m":
        case "M":
          if (!ctrlKey && !metaKey) {
            cycleModes();
          }
          break;

        case "f":
        case "F":
          if (!ctrlKey && !metaKey) {
            toggleZenMode();
            callbacks.onToggleZenMode();
          }
          break;

        case "s":
        case "S":
          if (!ctrlKey && !metaKey) {
            callbacks.onToggleSettings();
          }
          break;

        case "Escape":
          if (callbacks.onExitReader) {
            callbacks.onExitReader();
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [callbacks, readingMode, cycleModes, toggleZenMode]);

  return { readingMode, cycleModes };
};
