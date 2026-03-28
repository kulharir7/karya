/**
 * GET  /api/v1/workflows — List workflow templates and runs
 * POST /api/v1/workflows — Run a workflow
 * 
 * Query params:
 *   ?action=templates — List available workflow templates (default)
 *   ?action=runs — List recent runs
 *   ?action=stats — Get execution statistics
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiCreated, apiBadRequest, apiServerError } from "@/lib/api-response";
import {
  getWorkflowTemplates,
  listWorkflowRuns,
  createWorkflowRun,
  getWorkflowStats,
} from "@/lib/workflow-engine";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "workflows-list");
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "templates";

    if (action === "stats") {
      const stats = await getWorkflowStats();
      return apiOk(stats);
    }

    if (action === "runs") {
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      const runs = await listWorkflowRuns({ limit });
      return apiOk({ runs, count: runs.length });
    }

    // Default: templates
    const templates = getWorkflowTemplates();
    return apiOk({
      templates,
      count: templates.length,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "workflows-run");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { workflowId, input } = body;

    if (!workflowId || typeof workflowId !== "string") {
      return apiBadRequest("workflowId is required");
    }

    const run = await createWorkflowRun(workflowId, input || {});
    return apiCreated(run);
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
