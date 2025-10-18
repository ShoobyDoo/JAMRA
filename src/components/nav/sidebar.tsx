"use client";

import { useMemo } from "react";
import Link from "next/link";
import { routes } from "@/lib/routes";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { User, Settings, LogOut, LogIn } from "lucide-react";
import { Box, Button, Divider, Menu, Stack, Text, Tooltip } from "@mantine/core";
import { usePathname } from "next/navigation";
import { GlobalDownloadStatus } from "@/components/downloads/global-download-status";
import { HEADER_HEIGHT_CLASS } from "@/lib/constants";
import { Logo } from "@/components/ui/logo";

export function Sidebar() {
  const { collapsed } = useUIStore();
  const pathname = usePathname();

  const sidebarRoutes = useMemo(
    () => routes.filter((route) => route.inSidebar),
    []
  );
  const isRouteActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path) && path !== "/";

  // Replace with real auth state once available
  const isSignedIn = false;

  const handleSignOut = () => {
    // Clear any stored authentication data
    // When auth is implemented, this should call the auth provider's signOut method
    if (typeof window !== "undefined") {
      // Clear localStorage items (except reader settings and progress which should persist)
      const keysToPreserve = [
        "reader-settings-storage",
        "reading-progress-storage",
      ];
      const allKeys = Object.keys(localStorage);

      allKeys.forEach((key) => {
        if (!keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      // Redirect to home page
      window.location.href = "/";
    }
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
      className="flex h-full min-h-0 w-full flex-shrink-0 flex-col bg-card text-card-foreground"
      aria-label="Primary navigation"
    >
      <Box className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <Box
          className={cn(
            "flex items-center gap-3 px-3 border-b border-border",
            HEADER_HEIGHT_CLASS
          )}
        >
          <div className={cn("flex h-full w-full items-center", collapsed ? "justify-center" : "justify-start")}>
            <Logo size={36} className="flex-shrink-0" />
            <div
              className={cn(
                "min-w-0 flex flex-col justify-center overflow-hidden transition-[max-width,opacity,margin] duration-300",
                collapsed
                  ? "max-w-0 opacity-0 ml-0"
                  : "ml-3 max-w-[200px] opacity-100"
              )}
            >
              <Text fw={700} fz={16} lh={1.25} className="whitespace-nowrap">
                JAMRA
              </Text>
              <Text
                size="10px"
                c="dimmed"
                className="whitespace-nowrap leading-tight"
                p={0}
              >
                just another manga reader app
              </Text>
            </div>
          </div>
        </Box>
        <Box className="flex-1 overflow-y-auto">
          <Stack gap="xs" px="xs" py="md">
            {sidebarRoutes.map(({ path, label, icon: Icon }) => {
              const isActive = isRouteActive(path);
              const button = (
                <Button
                  key={path}
                  component={Link}
                  href={path}
                  variant={isActive ? "filled" : "default"}
                  radius="md"
                  fullWidth
                  p={collapsed ? 0 : undefined}
                  justify={collapsed ? "center" : "flex-start"}
                  className={cn(
                    "flex items-center overflow-hidden transition-all duration-300",
                    !collapsed && "pl-3 pr-3"
                  )}
                  aria-label={label}
                >
                  {Icon && (
                    <Icon
                      size={18}
                      strokeWidth={2}
                      aria-hidden
                      className="flex-shrink-0"
                    />
                  )}
                  <span
                    className={cn(
                      "whitespace-nowrap overflow-hidden transition-[max-width,opacity,margin] duration-300",
                      collapsed
                        ? "max-w-0 opacity-0 ml-0"
                        : "ml-2 max-w-[140px] opacity-100"
                    )}
                  >
                    {label}
                  </span>
                </Button>
              );

              return collapsed ? (
                <Tooltip key={path} label={label} position="right" withArrow>
                  {button}
                </Tooltip>
              ) : (
                button
              );
            })}
          </Stack>
        </Box>
      </Box>

      <GlobalDownloadStatus />

      <Divider className="flex-shrink-0" />

      <Box px="xs" py="md" className="flex flex-shrink-0 w-full">
        <Menu withinPortal>
          <Menu.Target>
            {collapsed ? (
              <Tooltip label="Account" position="right" withArrow>
                <Button
                  variant="default"
                  radius="md"
                  fullWidth
                  p={0}
                  justify="center"
                  className="flex items-center overflow-hidden transition-all duration-300"
                  aria-label="Account"
                >
                  <User
                    size={18}
                    strokeWidth={2}
                    aria-hidden
                    className="flex-shrink-0"
                  />
                  <span className="whitespace-nowrap overflow-hidden max-w-0 opacity-0 ml-0 transition-[max-width,opacity,margin] duration-300">
                    Account
                  </span>
                </Button>
              </Tooltip>
            ) : (
              <Button
                variant="default"
                radius="md"
                fullWidth
                justify="flex-start"
                className="flex items-center overflow-hidden pl-3 pr-3 transition-all duration-300"
                aria-label="Account"
              >
                <User
                  size={18}
                  strokeWidth={2}
                  aria-hidden
                  className="flex-shrink-0"
                />
                <span className="whitespace-nowrap overflow-hidden ml-3 max-w-[120px] opacity-100 transition-[max-width,opacity,margin] duration-300">
                  Account
                </span>
              </Button>
            )}
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
