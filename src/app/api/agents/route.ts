/**
 * GET /api/agents — List agents (legacy route, use /api/v1/agents instead)
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Redirect to v1 format
  const agents = [
    { id: "karya", name: "Supervisor", icon: "⚡" },
    { id: "karya-browser", name: "Browser Agent", icon: "🌐" },
    { id: "karya-file", name: "File Agent", icon: "📁" },
    { id: "karya-coder", name: "Coder Agent", icon: "💻" },
    { id: "karya-researcher", name: "Researcher Agent", icon: "🔬" },
    { id: "karya-data-analyst", name: "Data Analyst", icon: "📊" },
  ];
  return NextResponse.json({ agents, count: agents.length });
}
