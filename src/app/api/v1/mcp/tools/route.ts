/**
 * GET /api/v1/mcp/tools — List all tools exposed by Karya's MCP server
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiServerError } from "@/lib/api-response";
import { getAllToolNames, getToolsByCategory } from "@/lib/chat-processor";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "mcp-list");
  if (guard) return guard;

  try {
    const tools = getAllToolNames();
    const categories = getToolsByCategory();

    return apiOk({
      total: tools.length,
      tools,
      categories: Object.fromEntries(
        Object.entries(categories)
          .filter(([_, v]) => v.length > 0)
          .map(([k, v]) => [k, v])
      ),
      mcpPort: process.env.KARYA_MCP_PORT || "3001",
      mcpUrl: `http://localhost:${process.env.KARYA_MCP_PORT || "3001"}`,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
