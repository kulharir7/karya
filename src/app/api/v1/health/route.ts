/**
 * GET /api/v1/health — Lightweight health check (for monitoring)
 * 
 * Returns 200 if server is up. Minimal processing.
 */

import { handleCORS } from "@/lib/api-middleware";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET() {
  return Response.json({
    ok: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "0.5.0",
  });
}
