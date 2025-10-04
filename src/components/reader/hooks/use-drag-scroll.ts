import { useEffect, useRef, RefObject } from "react";

interface DragScrollOptions {
  enabled?: boolean;
  onDragScroll?: (deltaY: number) => void;
}

export function useDragScroll(
  elementRef: RefObject<HTMLElement | null>,
  options: DragScrollOptions = {}
) {
  const { enabled = true, onDragScroll } = options;
  const isDragging = useRef(false);
  const startY = useRef(0);
  const scrollTop = useRef(0);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only activate on primary mouse button (left click)
      if (e.button !== 0) return;

      // Don't activate if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" ||
        target.tagName === "INPUT" ||
        target.tagName === "A" ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("a")
      ) {
        return;
      }

      isDragging.current = true;
      startY.current = e.clientY;
      scrollTop.current = element.scrollTop;

      // Change cursor to grabbing
      element.style.cursor = "grabbing";
      element.style.userSelect = "none";

      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const deltaY = startY.current - e.clientY;

      if (onDragScroll) {
        onDragScroll(deltaY);
      } else {
        element.scrollTop = scrollTop.current + deltaY;
      }

      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;

      isDragging.current = false;

      // Reset cursor
      element.style.cursor = "";
      element.style.userSelect = "";
    };

    const handleMouseLeave = () => {
      if (!isDragging.current) return;

      isDragging.current = false;

      // Reset cursor
      element.style.cursor = "";
      element.style.userSelect = "";
    };

    // Set initial cursor
    element.style.cursor = "grab";

    element.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    element.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      element.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      element.removeEventListener("mouseleave", handleMouseLeave);
      element.style.cursor = "";
      element.style.userSelect = "";
    };
  }, [elementRef, enabled, onDragScroll]);

  return { isDragging: isDragging.current };
}
