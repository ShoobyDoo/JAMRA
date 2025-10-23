import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { HotZone } from "@/hooks/use-reader-controls";

interface HotZoneIndicatorProps {
  zone: HotZone;
}

export function HotZoneIndicator({ zone }: HotZoneIndicatorProps) {
  if (!zone || zone === "center") return null;

  const getIndicatorConfig = () => {
    switch (zone) {
      case "left":
        return {
          icon: ChevronLeft,
          wrapperClass:
            "fixed inset-y-0 left-0 flex items-center justify-start pl-6",
        };
      case "right":
        return {
          icon: ChevronRight,
          wrapperClass:
            "fixed inset-y-0 right-0 flex items-center justify-end pr-6",
        };
      case "top":
        return {
          icon: ChevronUp,
          wrapperClass:
            "fixed inset-x-0 top-0 flex items-start justify-center pt-6",
        };
      case "bottom":
        return {
          icon: ChevronDown,
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
        <Icon className="h-7 w-7 text-gray-900" strokeWidth={2.5} />
      </div>
    </div>
  );
}
