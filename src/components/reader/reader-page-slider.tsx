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

  // Show labels only when there's enough room
  const showFilledLabel = filledPct > 10;
  const showEmptyLabel = hasTotalPages && filledPct < 87;

  return (
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
      className={`relative h-7 w-full select-none overflow-hidden rounded-md ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      {/* Empty background */}
      <div className="absolute inset-0 bg-white/10" />

      {/* Filled portion */}
      <div
        className="absolute left-0 top-0 h-full bg-white/30 flex items-center px-2.5"
        style={{ width: `${filledPct}%` }}
      >
        {showFilledLabel && (
          <span className="text-xs font-semibold text-white leading-none whitespace-nowrap">
            {currentPage + 1}
          </span>
        )}
      </div>

      {/* Thumb — full-height grip centered on the fill boundary */}
      <div
        className={`absolute top-0 z-10 h-full w-4 -translate-x-1/2 flex items-center justify-center bg-white shadow-md ${
          active ? "brightness-90" : ""
        }`}
        style={{ left: `${filledPct}%` }}
      >
        <IconGripVertical size={11} className="text-gray-400" />
      </div>

      {/* Total pages label in empty section */}
      {showEmptyLabel && (
        <div className="absolute right-0 top-0 h-full flex items-center px-2.5 pointer-events-none">
          <span className="text-xs text-white/40 leading-none whitespace-nowrap">
            {totalPages}
          </span>
        </div>
      )}
    </div>
  );
};
