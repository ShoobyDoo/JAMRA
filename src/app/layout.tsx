import { Geist, Geist_Mono } from "next/font/google";
import "@mantine/core/styles.css";
import "@mantine/core/styles.layer.css";
import "@/app/globals.css";
import { AppWarmup } from "@/components/system/app-warmup";
import { StoreHydration } from "@/components/system/store-hydration";
import {
  DataErrorBoundary,
  ErrorBoundary,
} from "@/components/system/error-boundary";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body
        className="bg-background text-foreground antialiased"
        style={{ fontFamily: "var(--font-geist-mono)" }}
      >
        <ErrorBoundary>
          <MantineProvider defaultColorScheme="light">
            <ModalsProvider>
              <Notifications position="top-right" zIndex={10000} />
              <StoreHydration />
              <DataErrorBoundary
                title="Unable to initialise application"
                description="App warmup failed. Please retry in a moment."
              >
                <AppWarmup />
              </DataErrorBoundary>
              {children}
            </ModalsProvider>
          </MantineProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
