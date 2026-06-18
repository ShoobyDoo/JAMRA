import { AppShell } from "@mantine/core";
import React from "react";
import { Outlet } from "react-router";
import { LAYOUT } from "../constants/ui";
import { Header } from "./layout/Header";
import { Navbar } from "./layout/Navbar";

export const AppLayout: React.FC = () => {
  return (
    <AppShell
      className="h-screen overflow-hidden"
      withBorder={false}
      header={{ height: { base: LAYOUT.HEADER_HEIGHT } }}
      navbar={{
        width: { base: LAYOUT.NAVBAR_WIDTH },
        breakpoint: "sm",
      }}
    >
      <AppShell.Header>
        {/* header component */}
        <Header />
      </AppShell.Header>
      <AppShell.Navbar className="flex flex-1 items-center">
        <Navbar />
      </AppShell.Navbar>
      <AppShell.Main className="flex h-full min-h-0 min-w-0 overflow-hidden">
        <div
          className={`h-full min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-tl-lg border-t border-l ${LAYOUT.MAIN_PADDING}`}
          style={{
            borderColor: "var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
          }}
        >
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  );
};
