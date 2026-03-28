import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production: standalone output (includes server + static)
  // Creates .next/standalone/ — single folder deployable
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  serverExternalPackages: ["@browserbasehq/stagehand", "sharp", "pdf-parse", "archiver", "unzipper", "ws"],
};

export default nextConfig;
