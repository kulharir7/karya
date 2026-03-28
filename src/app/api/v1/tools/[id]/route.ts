/**
 * GET  /api/v1/tools/:id — Get tool details
 * POST /api/v1/tools/:id — Execute a tool directly
 * 
 * Body for POST:
 * {
 *   "args": { "path": "/home", "recursive": true }
 * }
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiNotFound, apiBadRequest, apiServerError } from "@/lib/api-response";
import { getAllToolNames, getToolsByCategory } from "@/lib/chat-processor";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "tools-list");
  if (guard) return guard;

  try {
    const { id } = await params;
    const allTools = getAllToolNames();

    if (!allTools.includes(id)) {
      return apiNotFound("Tool");
    }

    // Find category
    const categories = getToolsByCategory();
    let category = "unknown";
    for (const [cat, tools] of Object.entries(categories)) {
      if (tools.includes(id)) {
        category = cat;
        break;
      }
    }

    return apiOk({
      id,
      category,
      available: true,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "tools-run");
  if (guard) return guard;

  try {
    const { id } = await params;
    const allTools = getAllToolNames();

    if (!allTools.includes(id)) {
      return apiNotFound("Tool");
    }

    const body = await req.json().catch(() => ({}));
    const { args = {} } = body;

    // Execute tool via the agent with a direct instruction
    // This uses the chat processor to route through the agent
    const { processChat } = await import("@/lib/chat-processor");
    const result = await processChat({
      message: `Execute the tool "${id}" with these arguments: ${JSON.stringify(args)}. Use ONLY this specific tool, nothing else. Return the raw result.`,
      channel: "api",
    });

    return apiOk({
      toolId: id,
      result: result.text,
      toolCalls: result.toolCalls,
      durationMs: result.durationMs,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
