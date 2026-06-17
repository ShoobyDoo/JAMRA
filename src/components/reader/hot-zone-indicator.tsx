import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconChevronDown,
} from "@tabler/icons-react";
import type { useReaderControls } from "../../hooks/useReaderControls";

type HotZone = ReturnType<ReturnType<typeof useReaderControls>["getHotZone"]>;

interface HotZoneIndicatorProps {
  zone: HotZone;
}

export const HotZoneIndicator: React.FC<HotZoneIndicatorProps> = ({ zone }) => {
  if (!zone || zone === "center") return null;

  const getIndicatorConfig = () => {
    switch (zone) {
      case "left":
        return {
          icon: IconChevronLeft,
          wrapperClass:
            "fixed inset-y-0 left-0 flex items-center justify-start pl-6",
        };
      case "right":
        return {
          icon: IconChevronRight,
          wrapperClass:
            "fixed inset-y-0 right-0 flex items-center justify-end pr-6",
        };
      case "top":
        return {
          icon: IconChevronUp,
          wrapperClass:
            "fixed inset-x-0 top-0 flex items-start justify-center pt-6",
        };
      case "bottom":
        return {
          icon: IconChevronDown,
          wrapperClass:
            "fixed inset-x-0 bottom-0 flex items-end justify-center pb-6",
        };
      default:
        return null;
    }
  };

  const config = getIndicatorConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className={`${config.wrapperClass} pointer-events-none z-40`}>
      <div className="rounded-xl border border-white/30 bg-white/80 p-2.5 shadow-lg backdrop-blur-sm">
        <Icon size={28} strokeWidth={2.5} className="text-gray-900" />
      </div>
    </div>
  );
};
