"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function ScrollButtons() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateVisibility = () => {
      const { scrollY, innerHeight } = window;
      const scrollHeight = document.documentElement.scrollHeight;

      setShowScrollTop(scrollY > 240);
      setShowScrollBottom(scrollY + innerHeight < scrollHeight - 240);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);

    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  if (!showScrollTop && !showScrollBottom) {
    return null;
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="rounded-full bg-background/95 p-3 text-primary shadow-lg ring-1 ring-border transition hover:bg-background hover:scale-105 hover:"
          aria-label="Scroll to top"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="rounded-full bg-background/95 p-3 text-primary shadow-lg ring-1 ring-border transition hover:bg-background hover:scale-105"
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}
      
    </div>
  );
}
