import React, { useCallback } from "react";
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

  // Clamp the label's own translateX so it never gets clipped by the track edges,
  // mirroring Mantine's reference floating-label Slider behavior.
  const labelTranslateX = `clamp(-${filledPct}%, -50%, ${100 - filledPct}%)`;

  return (
    <div className="relative w-full pt-6">
      {/* Floating current-page label — follows the thumb, clamped so it's never clipped */}
      <div
        className="absolute bottom-full left-0 mb-1.5 whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-xs font-semibold leading-none text-gray-900 shadow-md"
        style={{
          left: `${filledPct}%`,
          transform: `translateX(${labelTranslateX})`,
        }}
      >
        {currentPage + 1}
      </div>

      <div
        ref={ref}
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
