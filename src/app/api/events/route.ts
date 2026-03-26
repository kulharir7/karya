import { NextRequest } from "next/server";
import { eventBus } from "@/lib/event-bus";

export const dynamic = "force-dynamic";

/**
 * GET /api/events — Get recent event log
 * Query: ?limit=50
 */
export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
  const log = eventBus.getLog(limit);
  return Response.json({ events: log, count: log.length });
}
