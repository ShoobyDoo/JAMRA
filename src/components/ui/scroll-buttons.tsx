"use client";

import { useEffect, useState, type RefObject } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ScrollButtonsProps {
  containerRef?: RefObject<HTMLElement | null>;
}

export function ScrollButtons({ containerRef }: ScrollButtonsProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let target: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | undefined;
    let rafId = 0;

    const updateVisibility = () => {
      if (target) {
        const { scrollTop, clientHeight, scrollHeight } = target;
        setShowScrollTop(scrollTop > 240);
        setShowScrollBottom(scrollTop + clientHeight < scrollHeight - 240);
      } else {
        const { scrollY, innerHeight } = window;
        const scrollHeight = document.documentElement.scrollHeight;
        setShowScrollTop(scrollY > 240);
        setShowScrollBottom(scrollY + innerHeight < scrollHeight - 240);
      }
    };

    const attach = () => {
      target = containerRef?.current ?? null;

      if (containerRef && !target) {
        rafId = window.requestAnimationFrame(attach);
        return;
      }

      updateVisibility();

      if (target) {
        target.addEventListener("scroll", updateVisibility, {
          passive: true,
        });
        resizeObserver = new ResizeObserver(() => updateVisibility());
        resizeObserver.observe(target);
      } else {
        window.addEventListener("scroll", updateVisibility, { passive: true });
        window.addEventListener("resize", updateVisibility);
      }
    };

    attach();

    const cleanup = () => {
      if (target) {
        target.removeEventListener("scroll", updateVisibility);
      } else {
        window.removeEventListener("scroll", updateVisibility);
        window.removeEventListener("resize", updateVisibility);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };

    return cleanup;
  }, [containerRef]);

  if (!showScrollTop && !showScrollBottom) {
    return null;
  }

  const scrollToTop = () => {
    const target = containerRef?.current;
    if (target) {
      target.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const scrollToBottom = () => {
    const target = containerRef?.current;
    if (target) {
      target.scrollTo({
        top: target.scrollHeight,
        behavior: "smooth",
      });
    } else {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-2">
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="rounded-full bg-background/95 p-3 text-primary shadow-lg ring-1 ring-border transition hover:bg-background hover:scale-105"
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
