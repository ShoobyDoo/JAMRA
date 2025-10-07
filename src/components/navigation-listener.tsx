"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useNavigationStore } from "@/store/navigation";

export function NavigationListener() {
  const pathname = usePathname();
  const setNavigating = useNavigationStore((state) => state.setNavigating);

  useEffect(() => {
    // Clear loading state when route changes
    setNavigating(false);
  }, [pathname, setNavigating]);

  return null;
}
