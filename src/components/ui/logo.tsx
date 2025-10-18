import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className }: LogoProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-primary text-primary-foreground font-bold",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.6,
      }}
    >
      J
    </div>
  );
}
