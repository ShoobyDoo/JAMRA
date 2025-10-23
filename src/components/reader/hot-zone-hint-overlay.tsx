import type { ReadingMode } from "@/store/reader-settings";

interface HotZoneHintOverlayProps {
  readingMode: ReadingMode;
  visible: boolean;
}

export function HotZoneHintOverlay({
  readingMode,
  visible,
}: HotZoneHintOverlayProps) {
  const isVertical = readingMode === "vertical";
  const isRTL = readingMode === "paged-rtl";

  const containerClasses = [
    "pointer-events-none",
    "fixed",
    "inset-0",
    "z-[45]",
    "transition-opacity",
    "duration-500",
    visible ? "opacity-100" : "opacity-0",
  ].join(" ");

  if (isVertical) {
    return (
      <div className={containerClasses}>
        <div className="absolute inset-x-0 top-0 h-1/3 bg-primary/20">
          <div className="flex justify-center pt-10">
            <HintBadge
              title="Hotzones"
              subtitle="Click near the top to move up"
            />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-primary/20">
          <div className="flex justify-center pb-10">
            <HintBadge
              title="Hotzones"
              subtitle="Click near the bottom to move down"
            />
          </div>
        </div>
      </div>
    );
  }

  const leftText = isRTL ? "Go forward" : "Go backward";
  const rightText = isRTL ? "Go backward" : "Go forward";

  return (
    <div className={containerClasses}>
      <div className="absolute inset-y-0 left-0 w-1/3 bg-primary/20">
        <div className="flex h-full items-center justify-start pl-8">
          <HintBadge
            title="Hotzones"
            subtitle={`${leftText} by clicking here`}
            align="left"
          />
        </div>
      </div>
      <div className="absolute inset-y-0 right-0 w-1/3 bg-primary/20">
        <div className="flex h-full items-center justify-end pr-8">
          <HintBadge
            title="Hotzones"
            subtitle={`${rightText} by clicking here`}
            align="right"
          />
        </div>
      </div>
    </div>
  );
}

function HintBadge({
  title,
  subtitle,
  align = "center",
}: {
  title: string;
  subtitle: string;
  align?: "center" | "right" | "left";
}) {
  const alignment =
    align === "center"
      ? "items-center text-center"
      : align === "right"
        ? "items-end text-right"
        : "items-start text-left";

  return (
    <div
      className={`flex flex-col gap-0.5 rounded-full bg-black/70 px-5 py-3 text-white shadow-lg backdrop-blur-md ${alignment}`}
    >
      <span className="text-sm font-semibold tracking-wide uppercase">
        {title}
      </span>
      <HintSubtitle>{subtitle}</HintSubtitle>
    </div>
  );
}

function HintSubtitle({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-normal text-white/80">{children}</span>;
}
