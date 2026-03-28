/**
 * GET  /api/v1/workflows/:id — Get workflow run status
 * PUT  /api/v1/workflows/:id — Update workflow run (cancel, etc.)
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiNotFound, apiBadRequest, apiServerError } from "@/lib/api-response";
import { getWorkflowRun, updateWorkflowRun } from "@/lib/workflow-engine";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "workflows-list");
  if (guard) return guard;

  try {
    const { id } = await params;
    const run = await getWorkflowRun(id);
    if (!run) return apiNotFound("Workflow run");
    return apiOk(run);
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "workflows-run");
  if (guard) return guard;

  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    if (action === "cancel") {
      await updateWorkflowRun(id, { status: "failed", error: "Cancelled by user" });
      return apiOk({ id, action: "cancelled" });
    }

    return apiBadRequest("action must be 'cancel'");
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
