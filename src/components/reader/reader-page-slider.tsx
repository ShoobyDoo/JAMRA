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

  // Clamp label position so it doesn't overflow at edges
  const labelLeft = Math.max(5, Math.min(filledPct, 95));

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
      className={`relative flex h-6 w-full select-none items-center ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      {/* Track */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20">
        {/* Filled portion */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-white transition-[width] duration-75"
          style={{ width: `${filledPct}%` }}
        />
      </div>

      {/* Thumb */}
      <div
        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full border border-white/30 bg-white shadow-md transition-transform duration-75 ${
          active ? "scale-110" : ""
        }`}
        style={{ left: `${filledPct}%` }}
      >
        <IconGripVertical size={10} className="text-gray-500" />
      </div>

      {/* Floating label — shown while dragging */}
      {active && (
        <div
          className="pointer-events-none absolute -top-8 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-xs font-medium text-white"
          style={{ left: `${labelLeft}%` }}
        >
          {currentPage + 1} / {totalPages}
        </div>
      )}
    </div>
  );
};
