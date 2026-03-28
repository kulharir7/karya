/**
 * GET  /api/v1/subagents — List sub-agents
 * POST /api/v1/subagents — Spawn, steer, kill sub-agents
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiCreated, apiBadRequest, apiNotFound, apiServerError } from "@/lib/api-response";
import {
  spawnSubAgent,
  spawnParallel,
  getSubAgent,
  listSubAgents,
  listRunningSubAgents,
  killSubAgent,
  steerSubAgent,
  getSubAgentStats,
  cleanupSubAgents,
} from "@/lib/subagent-spawner";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "read");
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const id = searchParams.get("id");

    if (action === "stats") return apiOk(getSubAgentStats());
    if (action === "running") return apiOk({ subagents: listRunningSubAgents() });

    if (id) {
      const sa = getSubAgent(id);
      if (!sa) return apiNotFound("Sub-agent");
      return apiOk(sa);
    }

    const parentId = searchParams.get("parentSessionId");
    return apiOk({
      subagents: listSubAgents(parentId || undefined),
      stats: getSubAgentStats(),
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "write");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "spawn") {
      const { parentSessionId, task, context, timeout } = body;
      if (!task) return apiBadRequest("task is required");
      const sa = await spawnSubAgent(parentSessionId || "api", task, { context, timeout });
      return apiCreated(sa);
    }

    if (action === "spawn-parallel") {
      const { parentSessionId, tasks, timeout, maxConcurrent } = body;
      if (!tasks?.length) return apiBadRequest("tasks array is required");
      const results = await spawnParallel(parentSessionId || "api", tasks, { timeout, maxConcurrent });
      return apiCreated({ subagents: results });
    }

    if (action === "steer") {
      const { id, instruction } = body;
      if (!id || !instruction) return apiBadRequest("id and instruction are required");
      const result = await steerSubAgent(id, instruction);
      if (!result) return apiNotFound("Sub-agent (or not running)");
      return apiOk(result);
    }

    if (action === "kill") {
      const { id } = body;
      if (!id) return apiBadRequest("id is required");
      return apiOk({ killed: killSubAgent(id) });
    }

    if (action === "cleanup") {
      const { maxAgeMs } = body;
      const deleted = cleanupSubAgents(maxAgeMs);
      return apiOk({ deleted });
    }

    return apiBadRequest("action must be: spawn, spawn-parallel, steer, kill, cleanup");
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
