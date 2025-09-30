"use client";

import Link from "next/link";
import { routes } from "@/lib/routes";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { User, Settings, LogOut, LogIn } from "lucide-react";

export function Sidebar() {
  const { collapsed, toggleCollapsed } = useUIStore();

  const sidebarWidth = collapsed ? "w-[72px]" : "w-[280px]";

  return (
    <aside
      className={cn(
        "bg-nav text-primary h-screen flex flex-col transition-all duration-300 border-r border-slate-800",
        sidebarWidth
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-slate-800">
        <span className={cn("font-bold text-lg", collapsed && "hidden")}>
          MangaReader
        </span>
        <button
          onClick={toggleCollapsed}
          className="p-2 rounded-md hover:bg-slate-800"
          aria-label="Toggle sidebar"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2">
        {routes
          .filter((r) => r.inSidebar)
          .map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              href={path}
              className={cn(
                "flex items-center gap-3 mx-2 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors",
                "text-slate-300 hover:text-indigo-400"
              )}
            >
              {Icon && <Icon className="w-5 h-5 shrink-0" />}
              {!collapsed && <span>{label}</span>}
            </Link>
          ))}
      </nav>

      {/* Account area at bottom */}
      <div className="mt-auto border-t border-slate-800 p-2 relative">
        <details className="group relative">
          <summary
            className={cn(
              "list-none cursor-pointer flex items-center gap-3 rounded-md hover:bg-slate-800 transition-colors",
              collapsed
                ? "p-2 mx-auto w-10 h-10 justify-center"
                : "px-3 py-2 mx-0"
            )}
          >
            {/* Avatar visual changes with collapsed state */}
            <span
              className={cn(
                "rounded-full bg-slate-700 text-slate-200 flex items-center justify-center shrink-0",
                collapsed ? "w-6 h-6" : "w-8 h-8"
              )}
              aria-hidden
            >
              <User className={cn(collapsed ? "w-3.5 h-3.5" : "w-4 h-4")} />
            </span>
            {!collapsed && <span className="text-sm">Account</span>}
          </summary>

          {/* Dropdown menu — positioned so it’s usable in both modes */}
          <ul
            className={cn(
              "absolute z-20 w-44 bg-nav border border-slate-800 rounded-md shadow-lg overflow-hidden",
              // Place to the right when collapsed; above when expanded (to avoid covering summary)
              collapsed
                ? "left-[72px] bottom-2"
                : "left-2 -top-1 translate-y-[-100%]"
            )}
          >
            <li>
              <Link
                href="/profile"
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800"
              >
                <User className="w-4 h-4" /> Profile
              </Link>
            </li>
            <li>
              <Link
                href="/settings"
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800"
              >
                <Settings className="w-4 h-4" /> Settings
              </Link>
            </li>
            <li>
              <Link
                href="/sign-in"
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800"
              >
                <LogIn className="w-4 h-4" /> Sign in
              </Link>
            </li>
            <li>
              <button className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-slate-800">
                <LogOut className="w-4 h-4" /> Log out
              </button>
            </li>
          </ul>
        </details>
      </div>
    </aside>
  );
}
