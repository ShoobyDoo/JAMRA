import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer =
  process.env.NEXT_BUNDLE_ANALYZE === "1"
    ? bundleAnalyzer({ enabled: true })
    : <T>(config: T) => config;

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  },
  images: {
    qualities: [75, 95],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "temp.compsci88.com",
      },
      {
        protocol: "https",
        hostname: "official.lowee.us",
      },
    ],
  },
};

export default withBundleAnalyzer(nextConfig);
