"use client";

import { useMemo } from "react";
import Link from "next/link";
import { routes } from "@/lib/routes";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { User, Settings, LogOut, LogIn } from "lucide-react";
import { Box, Button, Divider, Menu, Stack } from "@mantine/core";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const { collapsed } = useUIStore();
  const pathname = usePathname();

  const sidebarWidth = collapsed ? "w-[72px]" : "w-[200px]";
  const sidebarRoutes = useMemo(
    () => routes.filter((route) => route.inSidebar),
    [],
  );
  const isRouteActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path) && path !== "/";

  // Replace with real auth state once available
  const isSignedIn = false;

  const handleSignOut = () => {
    // TODO: integrate sign-out flow
  };

  const accountMenuItems = [
    { type: "link" as const, href: "/profile", label: "Profile", icon: User },
    {
      type: "link" as const,
      href: "/settings",
      label: "Settings",
      icon: Settings,
    },
    isSignedIn
      ? {
          type: "action" as const,
          label: "Sign out",
          icon: LogOut,
          onClick: handleSignOut,
        }
      : {
          type: "link" as const,
          href: "/sign-in",
          label: "Sign in",
          icon: LogIn,
        },
  ];

  return (
    <Box
      component="aside"
      className={cn(
        "flex h-full min-h-0 flex-shrink-0 flex-col border-r border-border bg-card text-card-foreground transition-[width] duration-300",
        sidebarWidth,
      )}
      aria-label="Primary navigation"
    >
      <Box className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <Box className="flex-1 overflow-y-auto">
          <Stack gap="xs" px="xs" py="md">
            {sidebarRoutes.map(({ path, label, icon: Icon }) => {
              const isActive = isRouteActive(path);
              return (
                <Button
                  key={path}
                  component={Link}
                  href={path}
                  variant={isActive ? "filled" : "default"}
                  radius="md"
                  fullWidth
                  justify={collapsed ? "center" : "flex-start"}
                  className={cn(
                    "flex items-center overflow-hidden transition-all duration-300",
                    collapsed ? "px-0" : "pl-2 pr-2",
                  )}
                  aria-label={label}
                >
                  {Icon && (
                    <span
                      className={cn(
                        "flex items-center justify-center transition-all duration-300",
                        collapsed ? "h-10 w-10" : "h-6 w-7",
                      )}
                    >
                      <Icon
                        className="h-full w-full"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </span>
                  )}
                  <span
                    className={cn(
                      "whitespace-nowrap transition-[max-width,opacity,margin] duration-300",
                      collapsed
                        ? "max-w-0 opacity-0"
                        : "ml-2 max-w-[140px] opacity-100",
                    )}
                  >
                    {label}
                  </span>
                </Button>
              );
            })}
          </Stack>
        </Box>
      </Box>

      <Divider className="flex-shrink-0" />

      <Box px="xs" py="md" className="flex flex-shrink-0 w-full">
        <Menu withinPortal>
          <Menu.Target>
            <Button
              variant="default"
              radius="md"
              fullWidth
              justify={collapsed ? "center" : "flex-start"}
              className={cn(
                "flex items-center overflow-hidden transition-all duration-300",
                collapsed ? "h-10 w-10 px-0" : "pl-3 pr-2",
              )}
              aria-label="Account"
            >
              <span
                className={cn(
                  "flex items-center justify-center transition-all duration-300",
                  collapsed ? "h-10 w-10" : "h-6 w-7",
                )}
              >
                <User className="h-full w-full" strokeWidth={2} aria-hidden />
              </span>
              <span
                className={cn(
                  "whitespace-nowrap transition-[max-width,opacity,margin] duration-300",
                  collapsed
                    ? "max-w-0 opacity-0"
                    : "ml-2 max-w-[120px] opacity-100",
                )}
              >
                Account
              </span>
            </Button>
          </Menu.Target>

          <Menu.Dropdown>
            {accountMenuItems.map((item) => {
              const Icon = item.icon;

              if (item.type === "link") {
                return (
                  <Menu.Item
                    key={item.label}
                    component={Link}
                    href={item.href}
                    leftSection={<Icon size={16} aria-hidden />}
                  >
                    {item.label}
                  </Menu.Item>
                );
              }

              return (
                <Menu.Item
                  key={item.label}
                  onClick={item.onClick}
                  color="red"
                  leftSection={<Icon size={16} aria-hidden />}
                >
                  {item.label}
                </Menu.Item>
              );
            })}
          </Menu.Dropdown>
        </Menu>
      </Box>
    </Box>
  );
}
