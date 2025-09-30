"use client";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";

export function Topbar() {
  return (
    <header className="sticky top-0 z-10 bg-nav h-14 border-b border-slate-800 flex items-center justify-between px-4 shadow-sm">
      <Breadcrumb />

      {/* Search (simple input, submit to /search) */}
      <form action="/search" method="GET" className="hidden md:block">
        <Input
          type="search"
          name="q"
          placeholder="Search manga…"
          className="w-64"
        />
      </form>
    </header>
  );
}
