/**
 * GET  /api/v1/heartbeat — Get heartbeat system status
 * POST /api/v1/heartbeat — Control heartbeat (start, stop, reload, run)
 * 
 * POST actions:
 *   { "action": "start" }   — Start heartbeat system
 *   { "action": "stop" }    — Stop heartbeat system
 *   { "action": "reload" }  — Re-parse HEARTBEAT.md
 *   { "action": "run", "taskId": "hb-..." } — Manually run a task
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiBadRequest, apiServerError } from "@/lib/api-response";
import { getHeartbeatManager } from "@/lib/heartbeat";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "status");
  if (guard) return guard;

  try {
    const mgr = getHeartbeatManager();
    return apiOk(mgr.getStatus());
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "write");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { action, taskId } = body;
    const mgr = getHeartbeatManager();

    switch (action) {
      case "start":
        mgr.start();
        return apiOk({ action: "started", status: mgr.getStatus() });

      case "stop":
        mgr.stop();
        return apiOk({ action: "stopped" });

      case "reload":
        mgr.reload();
        return apiOk({ action: "reloaded", status: mgr.getStatus() });

      case "run": {
        if (!taskId) return apiBadRequest("taskId is required");
        const result = await mgr.runTaskById(taskId);
        return apiOk({ action: "run", taskId, ...result });
      }

      default:
        return apiBadRequest("action must be: start, stop, reload, run");
    }
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
