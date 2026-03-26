import { NextRequest } from "next/server";
import {
  initScheduler,
  createTask,
  listTasks,
  getTask,
  toggleTask,
  deleteTask,
  runTaskNow,
  getSchedulerStats,
} from "@/lib/scheduler";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks — List all scheduled tasks or get stats
 * ?action=stats — get scheduler stats
 */
export async function GET(req: NextRequest) {
  await initScheduler();
  const action = req.nextUrl.searchParams.get("action");

  if (action === "stats") {
    const stats = await getSchedulerStats();
    return Response.json(stats);
  }

  const tasks = await listTasks();
  return Response.json({ tasks, count: tasks.length });
}

/**
 * POST /api/tasks — Create, toggle, delete, run tasks
 * 
 * { action: "create", name, type, task, intervalMs?, cronExpr?, runAt? }
 * { action: "toggle", id }
 * { action: "delete", id }
 * { action: "run", id }
 */
export async function POST(req: NextRequest) {
  await initScheduler();
  const body = await req.json();

  if (body.action === "create") {
    if (!body.name || !body.type || !body.task) {
      return Response.json({ error: "name, type, and task required" }, { status: 400 });
    }

    // Parse "remind me in X minutes" → one-shot timer
    if (body.type === "once" && body.delayMinutes) {
      body.runAt = Date.now() + body.delayMinutes * 60 * 1000;
    }

    const task = await createTask({
      name: body.name,
      type: body.type,
      task: body.task,
      intervalMs: body.intervalMs,
      cronExpr: body.cronExpr,
      runAt: body.runAt,
    });
    return Response.json({ success: true, task });
  }

  if (body.action === "toggle") {
    const task = await toggleTask(body.id);
    return Response.json({ success: true, task });
  }

  if (body.action === "delete") {
    await deleteTask(body.id);
    return Response.json({ success: true });
  }

  if (body.action === "run") {
    const result = await runTaskNow(body.id);
    return Response.json(result);
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
