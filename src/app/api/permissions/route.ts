/**
 * Permissions API — Manage tool permissions & confirmations
 * 
 * GET /api/permissions — List all tool permissions
 * GET /api/permissions?action=stats — Get stats
 * GET /api/permissions?action=pending — Get pending confirmations
 * POST /api/permissions — Confirm/deny tool execution
 */

import { NextRequest, NextResponse } from "next/server";
import {
  TOOL_RISKS,
  getPermissionStats,
  getToolsByRisk,
  getToolRiskInfo,
  requiresConfirmation,
  getDangerousTools,
  RISK_LEVELS,
} from "@/lib/tool-permissions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const tool = searchParams.get("tool");
  const risk = searchParams.get("risk");
  
  // Stats
  if (action === "stats") {
    return NextResponse.json(getPermissionStats());
  }
  
  // Dangerous tools
  if (action === "dangerous") {
    return NextResponse.json({
      tools: getDangerousTools(),
    });
  }
  
  // Risk level info
  if (action === "levels") {
    return NextResponse.json(RISK_LEVELS);
  }
  
  // Check specific tool
  if (tool) {
    const info = getToolRiskInfo(tool);
    return NextResponse.json({
      tool,
      info,
      requiresConfirmation: requiresConfirmation(tool),
    });
  }
  
  // Filter by risk
  if (risk) {
    const validRisks = ["safe", "moderate", "dangerous"];
    if (!validRisks.includes(risk)) {
      return NextResponse.json(
        { error: "Invalid risk level" },
        { status: 400 }
      );
    }
    return NextResponse.json({
      risk,
      tools: getToolsByRisk(risk as any),
    });
  }
  
  // All permissions
  return NextResponse.json({
    permissions: TOOL_RISKS,
    stats: getPermissionStats(),
  });
}

// POST not needed for now - confirmations handled elsewhere
