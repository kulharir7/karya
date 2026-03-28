/**
 * GET  /api/v1/tasks — List all scheduled tasks
 * POST /api/v1/tasks — Create a new task
 * 
 * Body for POST:
 * {
 *   "name": "Daily Backup",
 *   "type": "cron",           // "interval" | "cron" | "once"
 *   "cronExpr": "daily",      // cron: "hourly"|"daily"|"weekly"|"every-5-minutes" or cron expr
 *   "intervalMs": 60000,      // interval: milliseconds between runs
 *   "runAt": 1711612800000,   // once: run at this timestamp
 *   "task": "Backup all files from Desktop"
 * }
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiCreated, apiBadRequest, apiServerError } from "@/lib/api-response";
import { listTasks, createTask, getSchedulerStats } from "@/lib/scheduler";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "tasks-list");
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "stats") {
      const stats = await getSchedulerStats();
      return apiOk(stats);
    }

    const tasks = await listTasks();
    return apiOk({
      tasks,
      count: tasks.length,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "tasks-create");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { name, type, cronExpr, intervalMs, runAt, task } = body;

    if (!task || typeof task !== "string") {
      return apiBadRequest("task (instruction text) is required");
    }
    if (!type || !["interval", "cron", "once"].includes(type)) {
      return apiBadRequest("type must be 'interval', 'cron', or 'once'");
    }

    const created = await createTask({
      name: name || task.slice(0, 40),
      type,
      cronExpr,
      intervalMs,
      runAt,
      task,
    });

    return apiCreated(created);
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
