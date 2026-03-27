import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  serverExternalPackages: ["@browserbasehq/stagehand", "sharp", "pdf-parse", "archiver", "unzipper", "ws"],
};

export default nextConfig;
