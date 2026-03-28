/**
 * GET /api/v1/agents/:id — Get agent details
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiNotFound, apiServerError } from "@/lib/api-response";

const AGENT_IDS = ["karya", "karya-browser", "karya-file", "karya-coder", "karya-researcher", "karya-data-analyst"] as const;
type AgentId = typeof AGENT_IDS[number];

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "agents-list");
  if (guard) return guard;

  try {
    const { id } = await params;

    if (!AGENT_IDS.includes(id as AgentId)) {
      return apiNotFound("Agent");
    }

    // Get agent from Mastra
    const { mastra } = await import("@/mastra");
    const agent = mastra.getAgent(id as AgentId);

    // Use getInstructions() if available, otherwise show basic info
    let instructionPreview = "Dynamic instructions";
    try {
      const instructions = await (agent as any).getInstructions?.();
      if (typeof instructions === "string") {
        instructionPreview = instructions.slice(0, 500) + "...";
      }
    } catch {}

    return apiOk({
      id,
      name: (agent as any).name || id,
      instructions: instructionPreview,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
