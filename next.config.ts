import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    instrumentationHook: true,
  },
  serverExternalPackages: ["@browserbasehq/stagehand", "sharp", "pdf-parse", "archiver", "unzipper", "ws"],
};

export default nextConfig;
