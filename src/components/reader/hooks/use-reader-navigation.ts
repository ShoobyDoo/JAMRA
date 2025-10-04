import { useEffect, useCallback } from "react";
import { useReaderSettings, type ReadingMode } from "@/store/reader-settings";

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

const READING_MODES: ReadingMode[] = ["paged-ltr", "paged-rtl", "dual-page", "vertical"];

export function useReaderNavigation(callbacks: NavigationCallbacks) {
  const { readingMode, setReadingMode, toggleZenMode } = useReaderSettings();

  const cycleModes = useCallback(() => {
    const currentIndex = READING_MODES.indexOf(readingMode);
    const nextIndex = (currentIndex + 1) % READING_MODES.length;
    setReadingMode(READING_MODES[nextIndex]);
  }, [readingMode, setReadingMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const { key, shiftKey, ctrlKey, metaKey } = e;

      // Prevent browser defaults for reader keys
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
        // Navigation
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
          // In vertical mode, let default scroll behavior work
          break;

        case "ArrowUp":
          if (readingMode !== "vertical") {
            callbacks.onPrevPage();
          }
          // In vertical mode, let default scroll behavior work
          break;

        case " ":
          // Space = next page, Shift+Space = prev page
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

        // Mode controls
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

  return {
    readingMode,
    cycleModes,
  };
}
