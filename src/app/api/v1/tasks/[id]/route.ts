/**
 * GET    /api/v1/tasks/:id — Get task details
 * PUT    /api/v1/tasks/:id — Toggle or run task
 * DELETE /api/v1/tasks/:id — Delete task
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiNotFound, apiNoContent, apiServerError } from "@/lib/api-response";
import { getTask, toggleTask, deleteTask, runTaskNow } from "@/lib/scheduler";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "tasks-list");
  if (guard) return guard;

  try {
    const { id } = await params;
    const task = await getTask(id);
    if (!task) return apiNotFound("Task");
    return apiOk(task);
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "tasks-create");
  if (guard) return guard;

  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    // Run now
    if (action === "run") {
      const result = await runTaskNow(id);
      return apiOk({ id, ...result });
    }

    // Toggle (toggleTask flips enabled state)
    if (action === "toggle") {
      const updated = await toggleTask(id);
      if (!updated) return apiNotFound("Task");
      return apiOk(updated);
    }

    return apiOk({ id, message: "Use action: 'run' or 'toggle'" });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "tasks-delete");
  if (guard) return guard;

  try {
    const { id } = await params;
    await deleteTask(id);
    return apiNoContent();
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
