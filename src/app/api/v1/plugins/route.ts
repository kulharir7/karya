/**
 * GET  /api/v1/plugins — List plugins
 * POST /api/v1/plugins — Execute, toggle, or load a plugin
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiBadRequest, apiServerError } from "@/lib/api-response";
import {
  getPlugins,
  getPluginTools,
  executePluginTool,
  togglePlugin,
  getPluginStats,
} from "@/lib/plugin-api";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "plugins-list");
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "tools") {
      const tools = getPluginTools().map((t) => ({ id: t.id, description: t.description }));
      return apiOk({ tools, count: tools.length });
    }

    if (action === "stats") {
      return apiOk(getPluginStats());
    }

    const plugins = getPlugins().map((p) => ({
      id: p.meta.id,
      name: p.meta.name,
      version: p.meta.version,
      description: p.meta.description,
      enabled: p.enabled,
      toolCount: p.tools.size,
    }));

    return apiOk({ plugins, count: plugins.length });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "tools-run");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { action, toolId, args, id, enabled } = body;

    if (action === "execute") {
      if (!toolId) return apiBadRequest("toolId is required");
      const result = await executePluginTool(toolId, args || {});
      return apiOk({ toolId, result });
    }

    if (action === "toggle") {
      if (!id) return apiBadRequest("id is required");
      togglePlugin(id, enabled);
      return apiOk({ id, enabled });
    }

    return apiBadRequest("action must be 'execute' or 'toggle'");
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
