/**
 * GET /api/v1/status — Full system status (tools, sessions, memory, scheduler, plugins, MCP)
 * 
 * This is the "dashboard in JSON" endpoint. Returns everything about the system.
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiServerError } from "@/lib/api-response";
import { getAllToolNames, getToolsByCategory } from "@/lib/chat-processor";
import { listSessions } from "@/lib/session-manager";
import { rateLimiter } from "@/lib/rate-limiter";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "status");
  if (guard) return guard;

  try {
    // Gather status from all subsystems
    const [sessions, tools, categories] = await Promise.all([
      listSessions(),
      Promise.resolve(getAllToolNames()),
      Promise.resolve(getToolsByCategory()),
    ]);

    // Memory status
    let memoryStatus = "unknown";
    try {
      const { getMemoryInstance } = await import("@/lib/semantic-memory");
      const mem = await getMemoryInstance();
      memoryStatus = mem ? "active" : "none";
    } catch {
      memoryStatus = "unavailable";
    }

    // Scheduler status
    let schedulerInfo: any = { status: "unknown" };
    try {
      const { listTasks, getSchedulerStats } = await import("@/lib/scheduler");
      const tasks = await listTasks();
      const stats = await getSchedulerStats();
      schedulerInfo = {
        status: "active",
        taskCount: tasks.length,
        ...stats,
      };
    } catch {
      schedulerInfo = { status: "error" };
    }

    // MCP status
    let mcpInfo: any = { status: "unknown" };
    try {
      const { getMCPServers } = await import("@/mastra/mcp/client");
      const servers = getMCPServers();
      mcpInfo = {
        status: "active",
        serverCount: servers.length,
        enabledCount: servers.filter((s: any) => s.enabled).length,
      };
    } catch {
      mcpInfo = { status: "unavailable" };
    }

    // WebSocket status
    let wsInfo: any = { status: "unknown" };
    try {
      const { wsServer } = await import("@/lib/websocket-server");
      wsInfo = {
        status: "active",
        clients: wsServer.getClientCount(),
        port: process.env.KARYA_WS_PORT || "3002",
      };
    } catch {
      wsInfo = { status: "unavailable" };
    }

    // Build category summary
    const categorySummary: Record<string, number> = {};
    for (const [cat, catTools] of Object.entries(categories)) {
      if (catTools.length > 0) {
        categorySummary[cat] = catTools.length;
      }
    }

    return apiOk({
      server: {
        status: "running",
        version: process.env.npm_package_version || "0.5.0",
        nodeVersion: process.version,
        uptime: Math.floor(process.uptime()),
        uptimeHuman: formatUptime(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      sessions: {
        total: sessions.length,
        active: sessions.filter((s) => s.status === "active").length,
      },
      tools: {
        total: tools.length,
        categories: categorySummary,
      },
      agents: {
        total: 6,
        names: ["supervisor", "browser", "file", "coder", "researcher", "data-analyst"],
      },
      memory: memoryStatus,
      scheduler: schedulerInfo,
      mcp: mcpInfo,
      websocket: wsInfo,
      rateLimiter: rateLimiter.stats(),
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}
