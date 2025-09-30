import { cn } from "@/lib/utils";
import { forwardRef, InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-md border border-slate-800 bg-content px-3 py-1 text-sm text-primary shadow-sm transition-colors",
          "placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
