/**
 * GET /api/v1/tools — List all available tools (dynamic, not hardcoded)
 * 
 * Query params:
 *   ?category=browser — Filter by category
 *   ?search=file — Search tool names
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiServerError } from "@/lib/api-response";
import { getAllToolNames, getToolsByCategory } from "@/lib/chat-processor";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "tools-list");
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search")?.toLowerCase();

    const categorized = getToolsByCategory();

    // Category filter
    if (category && categorized[category]) {
      const tools = categorized[category];
      return apiOk({
        category,
        tools,
        count: tools.length,
      });
    }

    // Search filter
    if (search) {
      const allTools = getAllToolNames();
      const matched = allTools.filter((t) => t.toLowerCase().includes(search));
      return apiOk({
        query: search,
        tools: matched,
        count: matched.length,
      });
    }

    // Full listing
    const allTools = getAllToolNames();
    const categories: Record<string, { tools: string[]; count: number }> = {};
    for (const [cat, tools] of Object.entries(categorized)) {
      if (tools.length > 0) {
        categories[cat] = { tools, count: tools.length };
      }
    }

    return apiOk({
      total: allTools.length,
      categories,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
