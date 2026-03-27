/**
 * Karya Workflow Tools
 * 
 * Agent tools for creating, running, and managing workflows
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

// Tool 2: Run a workflow
export const workflowRunTool = createTool({
  id: "workflow-run",
  description: `Run a workflow by ID with the required input data.

Available workflows:
- web-scraper: Scrape a webpage (url, outputPath, selector?)
- file-organizer: Organize files by type (sourcePath, rules?)
- research-pipeline: Research a topic (query, sources?, depth?)
- data-processor: Analyze CSV/JSON/TXT files (filePath, outputFormat?)
- backup: Backup files to archive (sourcePaths[], backupPath)
- multi-source-research: PARALLEL search across Web + Wikipedia + News (query, maxResultsPerSource?)
- file-cleanup: HUMAN-APPROVED file deletion — suspends for confirmation (folderPath, criteria?)`,
  inputSchema: z.object({
    workflowId: z.enum(["web-scraper", "file-organizer", "research-pipeline", "data-processor", "backup", "multi-source-research", "file-cleanup"])
      .describe("Which workflow to run"),
    input: z.record(z.string(), z.any())
      .describe("Input data for the workflow (varies by workflow type)"),
  }),
  outputSchema: z.object({
    runId: z.string(),
    status: z.string(),
    result: z.any().nullable(),
    error: z.string().nullable(),
  }),
  execute: async ({ workflowId, input }) => {
    // Get the workflow
    const workflow = workflows[workflowId as WorkflowId];
    if (!workflow) {
      return {
        runId: "",
        status: "failed",
        result: null,
        error: `Unknown workflow: ${workflowId}`,
      };
    }
    
    try {
      // Persist to our tracking DB first
      const trackingId = await workflowEngine.createRun(workflowId, input as Record<string, unknown>);
      
      // Create and run
      const run = await (workflow as any).createRun();
      const result = await run.start({ inputData: input });
      
      // Update tracking
      await workflowEngine.updateRun(trackingId, {
        status: result.status === "success" ? "success" : "failed",
        outputData: result.status === "success" ? (result as any).result : null,
        error: result.status === "failed" ? (result as any).error?.message || "Unknown error" : null,
        completedAt: Date.now(),
      });
      
      return {
        runId: trackingId,
        status: result.status,
        result: result.status === "success" ? (result as any).result : null,
        error: result.status === "failed" ? (result as any).error?.message || "Unknown error" : null,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        runId: "",
        status: "failed",
        result: null,
        error: errorMsg,
      };
    }
  },
});

// Tool 3: Get workflow status
export const workflowStatusTool = createTool({
  id: "workflow-status",
  description: "Get the status of a workflow run by its run ID",
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
      error: z.string().nullable(),
      createdAt: z.number(),
      updatedAt: z.number(),
      completedAt: z.number().nullable(),
    }).nullable(),
  }),
  execute: async ({ runId }) => {
    const run = await workflowEngine.getRun(runId);
    
    if (!run) {
      return { found: false, run: null };
    }
    
    return {
      found: true,
      run: {
        id: run.id,
        workflowId: run.workflowId,
        status: run.status,
        currentStep: run.currentStep,
        error: run.error,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        completedAt: run.completedAt,
      },
    };
  },
});

// Tool 4: List recent workflow runs
export const workflowHistoryTool = createTool({
  id: "workflow-history",
  description: "List recent workflow runs with their status",
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
      createdAt: z.number(),
      completedAt: z.number().nullable(),
    })),
    count: z.number(),
  }),
  execute: async ({ workflowId, status, limit }) => {
    const runs = await workflowEngine.listRuns({
      workflowId,
      status,
      limit: limit || 10,
    });
    
    return {
      runs: runs.map((r) => ({
        id: r.id,
        workflowId: r.workflowId,
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
      count: runs.length,
    };
  },
});

// Tool 5: Resume suspended workflow
export const workflowResumeTool = createTool({
  id: "workflow-resume",
  description: "Resume a suspended workflow with the required data",
  inputSchema: z.object({
    runId: z.string().describe("The workflow run ID to resume"),
    resumeData: z.record(z.string(), z.any()).describe("Data to provide for the suspended step"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    status: z.string(),
    result: z.any().nullable(),
    error: z.string().nullable(),
  }),
  execute: async ({ runId, resumeData }) => {
    const run = await workflowEngine.getRun(runId);
    
    if (!run) {
      return {
        success: false,
        status: "not_found",
        result: null,
        error: "Workflow run not found",
      };
    }
    
    if (run.status !== "suspended") {
      return {
        success: false,
        status: run.status,
        result: null,
        error: `Workflow is not suspended (current status: ${run.status})`,
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
        };
      }
      
      // Resume the workflow
      const workflowRun = await (workflow as any).createRun({ runId });
      const result = await workflowRun.resume({
        step: run.currentStep || undefined,
        resumeData,
      });
      
      // Update our tracking
      await workflowEngine.updateRun(runId, {
        status: result.status === "success" ? "success" : result.status === "suspended" ? "suspended" : "failed",
        outputData: result.status === "success" ? (result as any).result : null,
        completedAt: result.status === "success" ? Date.now() : null,
      });
      
      return {
        success: result.status === "success",
        status: result.status,
        result: result.status === "success" ? (result as any).result : null,
        error: result.status === "failed" ? (result as any).error?.message : null,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        status: "error",
        result: null,
        error: errorMsg,
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
