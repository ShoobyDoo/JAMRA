import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useMove } from "@mantine/hooks";
import { IconGripVertical } from "@tabler/icons-react";

interface ReaderPageSliderProps {
  currentPage: number;
  totalPages: number;
  disabled?: boolean;
  onChange: (pageIndex: number) => void;
}

export const ReaderPageSlider: React.FC<ReaderPageSliderProps> = ({
  currentPage,
  totalPages,
  disabled = false,
  onChange,
}) => {
  const hasTotalPages = totalPages > 0;
  const filledPct =
    hasTotalPages && totalPages > 1
      ? (currentPage / (totalPages - 1)) * 100
      : 0;

  const handleMove = useCallback(
    ({ x }: { x: number }) => {
      if (disabled || !hasTotalPages || totalPages <= 1) return;
      const pageIndex = Math.round(x * (totalPages - 1));
      onChange(Math.max(0, Math.min(pageIndex, totalPages - 1)));
    },
    [disabled, hasTotalPages, totalPages, onChange],
  );

  const { ref, active } = useMove(handleMove);

  // Pixel-based clamp for the floating label so it never overhangs the track
  // edges. `filledPct` is a percentage of the TRACK width, while the label's
  // own width is a different unit entirely — mixing the two in a single
  // percent-based clamp (as before) is dimensionally invalid and silently
  // no-ops at the right extreme. Measuring actual widths in pixels sidesteps
  // the unit mismatch.
  const trackRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [labelWidth, setLabelWidth] = useState(0);

  useLayoutEffect(() => {
    const trackEl = trackRef.current;
    const labelEl = labelRef.current;
    if (!trackEl || !labelEl) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === trackEl) {
          setTrackWidth(entry.contentRect.width);
        } else if (entry.target === labelEl) {
          setLabelWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(trackEl);
    observer.observe(labelEl);
    setTrackWidth(trackEl.getBoundingClientRect().width);
    setLabelWidth(labelEl.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, [currentPage]);

  const thumbPx = (filledPct / 100) * trackWidth;
  const labelLeftPx = Math.max(
    0,
    Math.min(thumbPx - labelWidth / 2, trackWidth - labelWidth),
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(currentPage + 1, totalPages - 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(currentPage - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(totalPages - 1);
    }
  };

  return (
    <div className="relative w-full pt-6">
      {/* Floating current-page label — follows the thumb, clamped in pixels
          (derived from measured track/label widths) so it's never clipped */}
      <div
        ref={labelRef}
        className="absolute bottom-full mb-1.5 whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-xs font-semibold leading-none text-gray-900 shadow-md"
        style={{
          left: labelWidth ? `${labelLeftPx}px` : `${filledPct}%`,
          transform: labelWidth ? "none" : "translateX(-50%)",
        }}
      >
        {currentPage + 1}
      </div>

      <div
        ref={(node) => {
          ref(node);
          trackRef.current = node;
        }}
        role="slider"
        aria-valuenow={currentPage + 1}
        aria-valuemin={1}
        aria-valuemax={totalPages || 1}
        aria-disabled={disabled}
        aria-label="Page slider"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        className={`relative h-7 w-full select-none rounded-md ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
      >
        {/* Empty background */}
        <div className="absolute inset-0 rounded-md bg-white/10" />

        {/* Filled portion */}
        <div
          className="absolute left-0 top-0 h-full rounded-md bg-white/30"
          style={{ width: `${filledPct}%` }}
        />

        {/* Thumb — full-height grip centered on the fill boundary */}
        <div
          className={`absolute top-0 z-10 h-full w-4 -translate-x-1/2 flex items-center justify-center bg-white shadow-md ${
            active ? "brightness-90" : ""
          }`}
          style={{ left: `${filledPct}%` }}
        >
          <IconGripVertical size={11} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
};
