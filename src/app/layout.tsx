import { Geist, Geist_Mono } from "next/font/google";
import "@mantine/core/styles.css";
import "@mantine/core/styles.layer.css";
import "@/app/globals.css";
import { AppWarmup } from "@/components/system/app-warmup";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";

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
      <body className="bg-background text-foreground antialiased" style={{ fontFamily: 'var(--font-geist-mono)' }}>
        <MantineProvider defaultColorScheme="light">
          <AppWarmup />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
