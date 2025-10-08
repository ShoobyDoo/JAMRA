import {
  Home,
  Compass,
  BookMarked,
  History as HistoryIcon,
  Puzzle,
  User,
  Settings,
  LogIn,
} from "lucide-react";

export type Route = {
  path: string;
  label: string;
  icon?: React.ElementType;
  inSidebar?: boolean;
};

export const routes: Route[] = [
  { path: "/", label: "Home", icon: Home, inSidebar: true },
  { path: "/discover", label: "Discover", icon: Compass, inSidebar: true },
  { path: "/library", label: "Library", icon: BookMarked, inSidebar: true },
  { path: "/history", label: "History", icon: HistoryIcon, inSidebar: true },
  { path: "/extensions", label: "Extensions", icon: Puzzle, inSidebar: true },
  { path: "/profile", label: "Profile", icon: User, inSidebar: false },
  { path: "/settings", label: "Settings", icon: Settings, inSidebar: false },
  { path: "/sign-in", label: "Sign in", icon: LogIn, inSidebar: false },
];

export type MangaRouteParams = {
  slug: string;
};

export type ReaderRouteParams = {
  slug: string;
  chapterSlug: string;
};

export type RouteSearchParams = Record<string, string | string[] | undefined>;

export function decodeRouteParam(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getSearchParam(
  params: RouteSearchParams | undefined,
  key: string,
): string | undefined {
  if (!params) return undefined;
  const value = params[key];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return undefined;
}
