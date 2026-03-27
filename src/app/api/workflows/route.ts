/**
 * Karya Workflows API
 * 
 * Endpoints:
 * GET /api/workflows - List templates and runs
 * POST /api/workflows - Run, resume, cancel workflows
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  workflowEngine, 
  WORKFLOW_TEMPLATES,
} from "@/lib/workflow-engine";
import { 
  workflows, 
  type WorkflowId,
} from "@/mastra/workflows";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get("action") || "templates";
  
  try {
    switch (action) {
      case "templates": {
        // List all workflow templates
        const category = searchParams.get("category");
        let templates = WORKFLOW_TEMPLATES;
        
        if (category && category !== "all") {
          templates = templates.filter((t) => t.category === category);
        }
        
        return NextResponse.json({
          templates: templates.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            icon: t.icon,
            inputSchema: t.inputSchema,
          })),
          count: templates.length,
        });
      }
      
      case "runs": {
        // List workflow runs
        const workflowId = searchParams.get("workflowId") || undefined;
        const status = searchParams.get("status") as any;
        const limit = parseInt(searchParams.get("limit") || "20");
        
        const runs = await workflowEngine.listRuns({
          workflowId,
          status,
          limit,
        });
        
        return NextResponse.json({
          runs: runs.map((r) => ({
            id: r.id,
            workflowId: r.workflowId,
            status: r.status,
            currentStep: r.currentStep,
            error: r.error,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            completedAt: r.completedAt,
          })),
          count: runs.length,
        });
      }
      
      case "run": {
        // Get specific run details
        const runId = searchParams.get("runId");
        if (!runId) {
          return NextResponse.json({ error: "runId required" }, { status: 400 });
        }
        
        const run = await workflowEngine.getRun(runId);
        if (!run) {
          return NextResponse.json({ error: "Run not found" }, { status: 404 });
        }
        
        return NextResponse.json({ run });
      }
      
      case "stats": {
        // Get workflow statistics
        const stats = await workflowEngine.getStats();
        const completed = stats.success + stats.failed;
        
        return NextResponse.json({
          ...stats,
          successRate: completed > 0 
            ? Math.round((stats.success / completed) * 100) 
            : null,
        });
      }
      
      case "active": {
        // Get active (running/suspended) runs
        const activeRuns = await workflowEngine.getActiveRuns();
        
        return NextResponse.json({
          runs: activeRuns.map((r) => ({
            id: r.id,
            workflowId: r.workflowId,
            status: r.status,
            currentStep: r.currentStep,
            createdAt: r.createdAt,
            suspendPayload: r.suspendPayload,
          })),
          count: activeRuns.length,
        });
      }
      
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Workflows API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, workflowId, input, runId, resumeData } = body;
    
    switch (action) {
      case "run": {
        // Run a workflow
        if (!workflowId || !input) {
          return NextResponse.json(
            { error: "workflowId and input required" },
            { status: 400 }
          );
        }
        
        const workflow = workflows[workflowId as WorkflowId];
        if (!workflow) {
          return NextResponse.json(
            { error: `Unknown workflow: ${workflowId}` },
            { status: 400 }
          );
        }
        
        // Create tracking record
        const trackingId = await workflowEngine.createRun(workflowId, input);
        
        // Update to running
        await workflowEngine.updateRun(trackingId, { status: "running" });
        
        // Execute workflow
        const run = await workflow.createRun();
        const result = await run.start({ inputData: input });
        
        // Update with result
        const suspendedSteps = result.status === "suspended" ? (result as any).suspended : null;
        await workflowEngine.updateRun(trackingId, {
          status: result.status === "success" ? "success" 
                : result.status === "suspended" ? "suspended" 
                : "failed",
          outputData: result.status === "success" ? (result as any).result : null,
          suspendPayload: result.status === "suspended" ? (result as any).suspendPayload : null,
          currentStep: suspendedSteps ? suspendedSteps[suspendedSteps.length - 1] : null,
          error: result.status === "failed" ? (result as any).error?.message : null,
          completedAt: result.status === "success" || result.status === "failed" ? Date.now() : null,
        });
        
        return NextResponse.json({
          runId: trackingId,
          status: result.status,
          result: result.status === "success" ? result.result : null,
          suspended: result.status === "suspended" ? result.suspended : null,
          suspendPayload: result.status === "suspended" ? result.suspendPayload : null,
          error: result.status === "failed" ? result.error?.message : null,
        });
      }
      
      case "resume": {
        // Resume a suspended workflow
        if (!runId || !resumeData) {
          return NextResponse.json(
            { error: "runId and resumeData required" },
            { status: 400 }
          );
        }
        
        const run = await workflowEngine.getRun(runId);
        if (!run) {
          return NextResponse.json({ error: "Run not found" }, { status: 404 });
        }
        
        if (run.status !== "suspended") {
          return NextResponse.json(
            { error: `Cannot resume workflow with status: ${run.status}` },
            { status: 400 }
          );
        }
        
        const workflow = workflows[run.workflowId as WorkflowId];
        if (!workflow) {
          return NextResponse.json(
            { error: `Unknown workflow: ${run.workflowId}` },
            { status: 400 }
          );
        }
        
        // Update to running
        await workflowEngine.updateRun(runId, { status: "running" });
        
        // Resume
        const workflowRun = await workflow.createRun({ runId });
        const result = await workflowRun.resume({
          step: run.currentStep || undefined,
          resumeData,
        });
        
        // Update with result
        const resumeSuspendedSteps = result.status === "suspended" ? (result as any).suspended : null;
        await workflowEngine.updateRun(runId, {
          status: result.status === "success" ? "success" 
                : result.status === "suspended" ? "suspended" 
                : "failed",
          outputData: result.status === "success" ? (result as any).result : null,
          currentStep: resumeSuspendedSteps ? resumeSuspendedSteps[resumeSuspendedSteps.length - 1] : null,
          error: result.status === "failed" ? (result as any).error?.message : null,
          completedAt: result.status === "success" || result.status === "failed" ? Date.now() : null,
        });
        
        return NextResponse.json({
          runId,
          status: result.status,
          result: result.status === "success" ? (result as any).result : null,
          error: result.status === "failed" ? (result as any).error?.message : null,
        });
      }
      
      case "cancel": {
        // Cancel a workflow
        if (!runId) {
          return NextResponse.json({ error: "runId required" }, { status: 400 });
        }
        
        const run = await workflowEngine.getRun(runId);
        if (!run) {
          return NextResponse.json({ error: "Run not found" }, { status: 404 });
        }
        
        if (run.status === "success" || run.status === "failed") {
          return NextResponse.json(
            { error: `Cannot cancel workflow with status: ${run.status}` },
            { status: 400 }
          );
        }
        
        await workflowEngine.updateRun(runId, {
          status: "failed",
          error: "Cancelled by user",
          completedAt: Date.now(),
        });
        
        return NextResponse.json({ success: true, message: "Workflow cancelled" });
      }
      
      case "delete": {
        // Delete a workflow run
        if (!runId) {
          return NextResponse.json({ error: "runId required" }, { status: 400 });
        }
        
        await workflowEngine.deleteRun(runId);
        
        return NextResponse.json({ success: true, message: "Workflow run deleted" });
      }
      
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Workflows API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
