import type { ReactNode } from "react";

interface PageHeadingProps {
  children: ReactNode;
  className?: string;
}

export function PageHeading({ children, className = "" }: PageHeadingProps) {
  return <h1 className={`text-2xl font-semibold ${className}`.trim()}>{children}</h1>;
}
