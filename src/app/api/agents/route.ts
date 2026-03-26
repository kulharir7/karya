import { NextRequest } from "next/server";
import { listAgentTypes, routeMessage } from "@/lib/agent-router";

export const dynamic = "force-dynamic";

/**
 * GET /api/agents — List all available agents
 * GET /api/agents?route=message — Test routing for a message
 */
export async function GET(req: NextRequest) {
  const routeTest = req.nextUrl.searchParams.get("route");

  if (routeTest) {
    const result = routeMessage(routeTest);
    return Response.json({ route: result });
  }

  const agents = listAgentTypes();
  return Response.json({ agents, count: agents.length });
}
