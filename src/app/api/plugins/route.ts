/**
 * Plugins API — Manage and execute plugin tools
 * 
 * GET /api/plugins — List plugins and tools
 * POST /api/plugins — Execute plugin tool or manage plugins
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getPlugins,
  getPlugin,
  getPluginTools,
  getPluginTool,
  executePluginTool,
  togglePlugin,
  unregisterPlugin,
  getPluginStats,
  loadPluginFile,
} from "@/lib/plugin-api";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const id = searchParams.get("id");

  // Stats
  if (action === "stats") {
    return NextResponse.json(getPluginStats());
  }

  // List tools only
  if (action === "tools") {
    const tools = getPluginTools().map((t) => ({
      id: t.id,
      description: t.description,
    }));
    return NextResponse.json({ tools });
  }

  // Get specific plugin
  if (id) {
    const plugin = getPlugin(id);
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: plugin.meta.id,
      name: plugin.meta.name,
      version: plugin.meta.version,
      description: plugin.meta.description,
      enabled: plugin.enabled,
      tools: Array.from(plugin.tools.keys()),
      loadedAt: plugin.loadedAt,
    });
  }

  // List all plugins
  const plugins = getPlugins().map((p) => ({
    id: p.meta.id,
    name: p.meta.name,
    version: p.meta.version,
    description: p.meta.description,
    enabled: p.enabled,
    toolCount: p.tools.size,
    loadedAt: p.loadedAt,
  }));

  return NextResponse.json({
    plugins,
    stats: getPluginStats(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "execute": {
        const { toolId, args, sessionId } = body;

        if (!toolId) {
          return NextResponse.json(
            { error: "toolId is required" },
            { status: 400 }
          );
        }

        const tool = getPluginTool(toolId);
        if (!tool) {
          return NextResponse.json(
            { error: `Plugin tool not found: ${toolId}` },
            { status: 404 }
          );
        }

        const result = await executePluginTool(toolId, args || {}, sessionId);

        return NextResponse.json({
          success: true,
          toolId,
          result,
        });
      }

      case "toggle": {
        const { id, enabled } = body;

        if (!id) {
          return NextResponse.json(
            { error: "id is required" },
            { status: 400 }
          );
        }

        const success = togglePlugin(id, enabled);

        return NextResponse.json({ success });
      }

      case "unregister": {
        const { id } = body;

        if (!id) {
          return NextResponse.json(
            { error: "id is required" },
            { status: 400 }
          );
        }

        const success = unregisterPlugin(id);

        return NextResponse.json({ success });
      }

      case "load": {
        const { filePath } = body;

        if (!filePath) {
          return NextResponse.json(
            { error: "filePath is required" },
            { status: 400 }
          );
        }

        const plugin = await loadPluginFile(filePath);

        if (!plugin) {
          return NextResponse.json(
            { error: "Failed to load plugin" },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          plugin: {
            id: plugin.meta.id,
            name: plugin.meta.name,
            version: plugin.meta.version,
          },
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: execute, toggle, unregister, load" },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
