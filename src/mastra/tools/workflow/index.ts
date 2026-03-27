/**
 * Karya Workflow Tools
 * 
 * Agent tools for creating, running, and managing workflows
 * Now with async execution and real-time progress!
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { 
  workflowEngine, 
  WORKFLOW_TEMPLATES,
} from "@/lib/workflow-engine";
import { 
  workflows, 
  type WorkflowId,
} from "@/mastra/workflows";
import { eventBus } from "@/lib/event-bus";

// Tool 1: List available workflows
export const workflowListTool = createTool({
  id: "workflow-list",
  description: "List all available workflow templates. Use this to see what automated workflows are available.",
  inputSchema: z.object({
    category: z.enum(["browser", "file", "data", "automation", "research", "custom", "all"])
      .optional()
      .default("all")
      .describe("Filter workflows by category"),
  }),
  outputSchema: z.object({
    workflows: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      category: z.string(),
      icon: z.string(),
    })),
    count: z.number(),
  }),
  execute: async ({ category }) => {
    let templates = WORKFLOW_TEMPLATES;
    
    if (category && category !== "all") {
      templates = templates.filter((t) => t.category === category);
    }
    
    return {
      workflows: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        icon: t.icon,
      })),
      count: templates.length,
    };
  },
});

// Tool 2: Run a workflow (ASYNC - returns immediately with runId for polling)
export const workflowRunTool = createTool({
  id: "workflow-run",
  description: `Run a workflow ASYNCHRONOUSLY. Returns a runId immediately for status polling.
Use workflow-status to check progress. For long-running workflows, use async=true.

Available workflows:
- web-scraper: Scrape a webpage with Stagehand (url, outputPath, selector?, useStagehand?)
- file-organizer: Organize files by type (sourcePath, rules?)
- research-pipeline: Research a topic (query, sources?, depth?)
- data-processor: Analyze CSV/JSON/TXT files (filePath, outputFormat?)
- backup: Backup files to archive (sourcePaths[], backupPath)
- multi-source-research: PARALLEL search across Web + Wikipedia + News (query, maxResultsPerSource?)
- file-cleanup: HUMAN-APPROVED file deletion — suspends for confirmation (folderPath, criteria?)
- batch-image-processor: FOREACH resize/compress images in folder (folderPath, maxWidth?, quality?, format?)
- url-monitor: DOUNTIL loop — poll URL until status/content found (url, targetStatus?, targetContent?, maxAttempts?)`,
  inputSchema: z.object({
    workflowId: z.enum(["web-scraper", "file-organizer", "research-pipeline", "data-processor", "backup", "multi-source-research", "file-cleanup", "batch-image-processor", "url-monitor"])
      .describe("Which workflow to run"),
    input: z.record(z.string(), z.any())
      .describe("Input data for the workflow (varies by workflow type)"),
    async: z.boolean().optional().default(true)
      .describe("If true, returns immediately with runId. If false, waits for completion (may block)."),
    maxWaitMs: z.number().optional().default(30000)
      .describe("Max time to wait in sync mode (default 30s)"),
  }),
  outputSchema: z.object({
    runId: z.string(),
    status: z.string(),
    result: z.any().nullable(),
    error: z.string().nullable(),
    message: z.string(),
  }),
  execute: async ({ workflowId, input, async: isAsync = true, maxWaitMs = 30000 }) => {
    // Get the workflow
    const workflow = workflows[workflowId as WorkflowId];
    if (!workflow) {
      return {
        runId: "",
        status: "failed",
        result: null,
        error: `Unknown workflow: ${workflowId}`,
        message: "Workflow not found",
      };
    }
    
    try {
      // Create tracking record
      const trackingId = await workflowEngine.createRun(workflowId, input as Record<string, unknown>);
      
      // Emit start event
      eventBus.emit("workflow:start", { runId: trackingId, workflowId, input });
      
      // Create the run
      const run = await (workflow as any).createRun();
      
      if (isAsync) {
        // ASYNC MODE: Start workflow in background, return immediately
        (async () => {
          try {
            const result = await run.start({ inputData: input });
            
            // Update tracking
            await workflowEngine.updateRun(trackingId, {
              status: result.status === "success" ? "success" : result.status === "suspended" ? "suspended" : "failed",
              outputData: result.status === "success" ? (result as any).result : null,
              error: result.status === "failed" ? (result as any).error?.message : null,
              completedAt: result.status !== "suspended" ? Date.now() : null,
            });
            
            // Emit completion event
            eventBus.emit("workflow:complete", { runId: trackingId, workflowId, status: result.status, result });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            await workflowEngine.updateRun(trackingId, {
              status: "failed",
              error: errorMsg,
              completedAt: Date.now(),
            });
            eventBus.emit("workflow:error", { runId: trackingId, workflowId, error: errorMsg });
          }
        })();
        
        return {
          runId: trackingId,
          status: "running",
          result: null,
          error: null,
          message: `Workflow started. Use workflow-status with runId "${trackingId}" to check progress.`,
        };
      } else {
        // SYNC MODE: Wait for completion (with timeout)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Workflow timed out after ${maxWaitMs}ms`)), maxWaitMs);
        });
        
        try {
          const result = await Promise.race([
            run.start({ inputData: input }),
            timeoutPromise,
          ]) as any;
          
          // Update tracking
          await workflowEngine.updateRun(trackingId, {
            status: result.status === "success" ? "success" : result.status === "suspended" ? "suspended" : "failed",
            outputData: result.status === "success" ? result.result : null,
            error: result.status === "failed" ? result.error?.message : null,
            completedAt: result.status !== "suspended" ? Date.now() : null,
          });
          
          return {
            runId: trackingId,
            status: result.status,
            result: result.status === "success" ? result.result : null,
            error: result.status === "failed" ? result.error?.message : null,
            message: result.status === "suspended" 
              ? `Workflow suspended. Use workflow-resume with runId "${trackingId}" to continue.`
              : `Workflow ${result.status}`,
          };
        } catch (timeoutError) {
          // Still running but timed out
          return {
            runId: trackingId,
            status: "running",
            result: null,
            error: null,
            message: `Workflow still running. Use workflow-status with runId "${trackingId}" to check progress.`,
          };
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        runId: "",
        status: "failed",
        result: null,
        error: errorMsg,
        message: "Failed to start workflow",
      };
    }
  },
});

// Tool 3: Get workflow status (with step progress)
export const workflowStatusTool = createTool({
  id: "workflow-status",
  description: "Get the status of a workflow run by its run ID. Includes step progress for running workflows.",
  inputSchema: z.object({
    runId: z.string().describe("The workflow run ID"),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    run: z.object({
      id: z.string(),
      workflowId: z.string(),
      status: z.string(),
      currentStep: z.string().nullable(),
      progress: z.object({
        completedSteps: z.number(),
        totalSteps: z.number(),
        percentage: z.number(),
      }).nullable(),
      result: z.any().nullable(),
      error: z.string().nullable(),
      createdAt: z.number(),
      updatedAt: z.number(),
      completedAt: z.number().nullable(),
      suspendPayload: z.any().nullable(),
    }).nullable(),
    actionRequired: z.string().nullable(),
  }),
  execute: async ({ runId }) => {
    const run = await workflowEngine.getRun(runId);
    
    if (!run) {
      return { found: false, run: null, actionRequired: null };
    }
    
    // Check if action is required (suspended workflow)
    let actionRequired: string | null = null;
    if (run.status === "suspended") {
      actionRequired = `Workflow is suspended at step "${run.currentStep}". Use workflow-resume with runId "${runId}" and provide the required resumeData.`;
      
      // If it's file-cleanup, provide more specific instructions
      if (run.workflowId === "file-cleanup") {
        actionRequired = `File cleanup workflow is waiting for approval. Use workflow-resume with runId "${runId}" and resumeData: { "approved": true } to proceed or { "approved": false } to cancel.`;
      }
    }
    
    return {
      found: true,
      run: {
        id: run.id,
        workflowId: run.workflowId,
        status: run.status,
        currentStep: run.currentStep,
        progress: null, // TODO: Add step tracking
        result: run.outputData,
        error: run.error,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        completedAt: run.completedAt,
        suspendPayload: run.suspendPayload,
      },
      actionRequired,
    };
  },
});

// Tool 4: List recent workflow runs
export const workflowHistoryTool = createTool({
  id: "workflow-history",
  description: "List recent workflow runs with their status. Use to find suspended workflows needing action.",
  inputSchema: z.object({
    workflowId: z.string().optional().describe("Filter by workflow ID"),
    status: z.enum(["pending", "running", "suspended", "success", "failed"]).optional(),
    limit: z.number().optional().default(10),
  }),
  outputSchema: z.object({
    runs: z.array(z.object({
      id: z.string(),
      workflowId: z.string(),
      status: z.string(),
      currentStep: z.string().nullable(),
      createdAt: z.number(),
      completedAt: z.number().nullable(),
      needsAction: z.boolean(),
    })),
    count: z.number(),
    suspendedCount: z.number(),
  }),
  execute: async ({ workflowId, status, limit }) => {
    const runs = await workflowEngine.listRuns({
      workflowId,
      status,
      limit: limit || 10,
    });
    
    const suspendedCount = runs.filter(r => r.status === "suspended").length;
    
    return {
      runs: runs.map((r) => ({
        id: r.id,
        workflowId: r.workflowId,
        status: r.status,
        currentStep: r.currentStep,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        needsAction: r.status === "suspended",
      })),
      count: runs.length,
      suspendedCount,
    };
  },
});

// Tool 5: Resume suspended workflow (improved with approval shortcuts)
export const workflowResumeTool = createTool({
  id: "workflow-resume",
  description: `Resume a suspended workflow. 

For file-cleanup workflow: Use resumeData: { "approved": true } to proceed with deletion, or { "approved": false } to cancel.
For other workflows: Provide the data the suspended step is waiting for.`,
  inputSchema: z.object({
    runId: z.string().describe("The workflow run ID to resume"),
    resumeData: z.record(z.string(), z.any()).describe("Data for the suspended step (e.g., { approved: true })"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    status: z.string(),
    result: z.any().nullable(),
    error: z.string().nullable(),
    message: z.string(),
  }),
  execute: async ({ runId, resumeData }) => {
    const run = await workflowEngine.getRun(runId);
    
    if (!run) {
      return {
        success: false,
        status: "not_found",
        result: null,
        error: "Workflow run not found",
        message: "Run not found",
      };
    }
    
    if (run.status !== "suspended") {
      return {
        success: false,
        status: run.status,
        result: null,
        error: `Workflow is not suspended (current status: ${run.status})`,
        message: `Cannot resume workflow with status: ${run.status}`,
      };
    }
    
    try {
      // Get the actual workflow
      const workflow = workflows[run.workflowId as WorkflowId];
      if (!workflow) {
        return {
          success: false,
          status: "error",
          result: null,
          error: `Unknown workflow: ${run.workflowId}`,
          message: "Workflow definition not found",
        };
      }
      
      // Emit resume event
      eventBus.emit("workflow:resume", { runId, workflowId: run.workflowId, resumeData });
      
      // Resume the workflow
      const workflowRun = await (workflow as any).createRun({ runId });
      const result = await workflowRun.resume({
        step: run.currentStep || undefined,
        resumeData,
      });
      
      // Update our tracking
      const newStatus = result.status === "success" ? "success" : result.status === "suspended" ? "suspended" : "failed";
      await workflowEngine.updateRun(runId, {
        status: newStatus,
        outputData: result.status === "success" ? (result as any).result : null,
        completedAt: result.status === "success" || result.status === "failed" ? Date.now() : null,
      });
      
      // Emit completion
      eventBus.emit("workflow:complete", { runId, workflowId: run.workflowId, status: newStatus, result });
      
      return {
        success: result.status === "success",
        status: result.status,
        result: result.status === "success" ? (result as any).result : null,
        error: result.status === "failed" ? (result as any).error?.message : null,
        message: result.status === "success" 
          ? "Workflow completed successfully" 
          : result.status === "suspended"
          ? "Workflow still suspended at another step"
          : "Workflow failed",
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        status: "error",
        result: null,
        error: errorMsg,
        message: "Failed to resume workflow",
      };
    }
  },
});

// Tool 6: Cancel workflow
export const workflowCancelTool = createTool({
  id: "workflow-cancel",
  description: "Cancel a running or suspended workflow",
  inputSchema: z.object({
    runId: z.string().describe("The workflow run ID to cancel"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ runId }) => {
    const run = await workflowEngine.getRun(runId);
    
    if (!run) {
      return { success: false, message: "Workflow run not found" };
    }
    
    if (run.status === "success" || run.status === "failed") {
      return { success: false, message: `Cannot cancel workflow with status: ${run.status}` };
    }
    
    await workflowEngine.updateRun(runId, {
      status: "failed",
      error: "Cancelled by user",
      completedAt: Date.now(),
    });
    
    eventBus.emit("workflow:cancel", { runId, workflowId: run.workflowId });
    
    return { success: true, message: "Workflow cancelled" };
  },
});

// Tool 7: Get workflow statistics
export const workflowStatsTool = createTool({
  id: "workflow-stats",
  description: "Get overall workflow execution statistics",
  inputSchema: z.object({}),
  outputSchema: z.object({
    total: z.number(),
    running: z.number(),
    suspended: z.number(),
    success: z.number(),
    failed: z.number(),
    successRate: z.string(),
    actionRequired: z.number(),
  }),
  execute: async () => {
    const stats = await workflowEngine.getStats();
    const completed = stats.success + stats.failed;
    const successRate = completed > 0 
      ? `${Math.round((stats.success / completed) * 100)}%` 
      : "N/A";
    
    return {
      ...stats,
      successRate,
      actionRequired: stats.suspended,
    };
  },
});

// Export all tools
export const workflowTools = [
  workflowListTool,
  workflowRunTool,
  workflowStatusTool,
  workflowHistoryTool,
  workflowResumeTool,
  workflowCancelTool,
  workflowStatsTool,
];
