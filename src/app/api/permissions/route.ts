import { NextRequest, NextResponse } from "next/server";
import {
  TOOL_RISKS,
  RISK_LEVELS,
  getRiskLevel,
  getToolRiskInfo,
  getToolsByRisk,
  getToolsByCategory,
  getDangerousTools,
  getPermissionStats,
  type RiskLevel,
} from "@/lib/tool-permissions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "list";
  const tool = searchParams.get("tool");
  const risk = searchParams.get("risk") as RiskLevel | null;
  const category = searchParams.get("category");

  try {
    switch (action) {
      case "list":
        // Return all tools with their risk info
        return NextResponse.json({
          tools: TOOL_RISKS,
          riskLevels: RISK_LEVELS,
          stats: getPermissionStats(),
        });

      case "stats":
        // Return summary stats only
        return NextResponse.json(getPermissionStats());

      case "tool":
        // Get info for specific tool
        if (!tool) {
          return NextResponse.json({ error: "Missing tool parameter" }, { status: 400 });
        }
        const info = getToolRiskInfo(tool);
        if (!info) {
          return NextResponse.json({ error: "Tool not found", tool }, { status: 404 });
        }
        return NextResponse.json({ tool, ...info });

      case "by-risk":
        // Get all tools with specific risk level
        if (!risk || !["safe", "moderate", "dangerous"].includes(risk)) {
          return NextResponse.json({ error: "Invalid risk level" }, { status: 400 });
        }
        return NextResponse.json({
          risk,
          tools: getToolsByRisk(risk),
          display: RISK_LEVELS[risk],
        });

      case "by-category":
        // Get all tools in a category
        if (!category) {
          return NextResponse.json({ error: "Missing category parameter" }, { status: 400 });
        }
        return NextResponse.json({
          category,
          tools: getToolsByCategory(category),
        });

      case "dangerous":
        // Get all dangerous tools that require confirmation
        return NextResponse.json({
          tools: getDangerousTools(),
          count: getDangerousTools().length,
        });

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Permissions API error:", error);
    return NextResponse.json(
      { error: "Internal error", message: String(error) },
      { status: 500 }
    );
  }
}
