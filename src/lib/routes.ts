import {
  Home,
  Compass,
  BookMarked,
  History as HistoryIcon,
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
  { path: "/profile", label: "Profile", icon: User, inSidebar: false },
  { path: "/settings", label: "Settings", icon: Settings, inSidebar: false },
  { path: "/sign-in", label: "Sign in", icon: LogIn, inSidebar: false },
];
