import { useEffect, useRef, useCallback } from "react";

export interface TouchGestureCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

const SWIPE_THRESHOLD = 50; // minimum distance for swipe
const SWIPE_VELOCITY = 0.3; // minimum velocity for swipe
const DOUBLE_TAP_DELAY = 300; // max delay between taps
const LONG_PRESS_DELAY = 500; // delay for long press

export function useTouchGestures(
  elementRef: React.RefObject<HTMLElement | null>,
  callbacks: TouchGestureCallbacks
) {
  const touchStart = useRef<TouchPoint | null>(null);
  const touchEnd = useRef<TouchPoint | null>(null);
  const lastTap = useRef<number>(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      // Start long press timer
      if (callbacks.onLongPress) {
        longPressTimer.current = setTimeout(() => {
          if (callbacks.onLongPress) {
            callbacks.onLongPress();
          }
        }, LONG_PRESS_DELAY);
      }
    },
    [callbacks]
  );

  const handleTouchMove = useCallback(() => {
    // Cancel long press if finger moves
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      // Cancel long press
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      const touch = e.changedTouches[0];
      if (!touch || !touchStart.current) return;

      touchEnd.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      const deltaX = touchEnd.current.x - touchStart.current.x;
      const deltaY = touchEnd.current.y - touchStart.current.y;
      const deltaTime = touchEnd.current.time - touchStart.current.time;

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;

      // Check for double tap
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_DELAY && absX < 10 && absY < 10) {
        if (callbacks.onDoubleTap) {
          callbacks.onDoubleTap();
        }
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;

      // Check for swipe
      if (velocity > SWIPE_VELOCITY) {
        if (absX > absY) {
          // Horizontal swipe
          if (absX > SWIPE_THRESHOLD) {
            if (deltaX > 0 && callbacks.onSwipeRight) {
              callbacks.onSwipeRight();
            } else if (deltaX < 0 && callbacks.onSwipeLeft) {
              callbacks.onSwipeLeft();
            }
          }
        } else {
          // Vertical swipe
          if (absY > SWIPE_THRESHOLD) {
            if (deltaY > 0 && callbacks.onSwipeDown) {
              callbacks.onSwipeDown();
            } else if (deltaY < 0 && callbacks.onSwipeUp) {
              callbacks.onSwipeUp();
            }
          }
        }
      }

      touchStart.current = null;
      touchEnd.current = null;
    },
    [callbacks]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: true });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);

      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd]);
}
