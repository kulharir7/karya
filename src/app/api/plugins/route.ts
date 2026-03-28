/**
 * GET /api/plugins — List plugins (legacy route, use /api/v1/plugins instead)
 * POST /api/plugins — Plugin actions (legacy)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listInstalledPlugins,
  getPluginRegistryStats,
  togglePluginEnabled,
} from "@/lib/plugin-registry";

export async function GET() {
  const plugins = listInstalledPlugins().map((p) => ({
    id: p.id,
    name: p.manifest.name,
    version: p.manifest.version,
    description: p.manifest.description,
    enabled: p.enabled,
    toolCount: p.hasSkill ? 1 : 0,
    loadedAt: p.installedAt,
  }));

  return NextResponse.json({
    plugins,
    stats: getPluginRegistryStats(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id, enabled } = body;

    if (action === "toggle" && id) {
      const success = togglePluginEnabled(id, enabled);
      return NextResponse.json({ success });
    }

    return NextResponse.json(
      { error: "Use /api/v1/plugins for full plugin management" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
