"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const match = routes.find((r) => r.path === href);
    return {
      href,
      label: match?.label ?? decodeURIComponent(seg),
      isLast: idx === segments.length - 1,
    };
  });

  // Special case: homepage
  if (segments.length === 0) {
    return (
      <nav className="text-sm text-slate-400">
        <span className="text-indigo-400">Home</span>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-2 text-sm text-slate-400">
      <Link href="/" className="hover:text-indigo-300">
        Home
      </Link>
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-2">
          <span>/</span>
          {c.isLast ? (
            <span className="text-indigo-400">{c.label}</span>
          ) : (
            <Link href={c.href} className="hover:text-indigo-300">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
