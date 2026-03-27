/**
 * Planning Tools — Point 5: Planning Agent
 * 
 * For complex tasks, agent creates a structured plan → user approves → agent executes step by step.
 * Also includes self-review (Point 6) and error recovery hints (Point 7).
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// In-memory plan storage (per session)
const activePlans: Map<string, {
  id: string;
  task: string;
  steps: { id: number; action: string; tool: string; status: "pending" | "running" | "done" | "failed" | "skipped"; result?: string; error?: string }[];
  status: "draft" | "approved" | "executing" | "completed" | "failed";
  createdAt: number;
  completedAt?: number;
  review?: string;
}> = new Map();

let planCounter = 0;

/**
 * create-plan — Agent breaks a complex task into numbered steps
 */
export const createPlanTool = createTool({
  id: "create-plan",
  description: `Create a structured execution plan for a complex task. Use this BEFORE executing when the task requires 3+ steps or multiple tools. 
Returns a plan with numbered steps that the user can review.
After creating a plan, ALWAYS present it to the user and ask "Shall I proceed?" before executing.`,
  inputSchema: z.object({
    task: z.string().describe("The user's original request / task description"),
    steps: z.array(z.object({
      action: z.string().describe("What this step does (human-readable description)"),
      tool: z.string().describe("Which tool to use (e.g. 'code-write', 'shell-execute', 'file-read')"),
    })).min(2).describe("Ordered list of execution steps"),
    complexity: z.enum(["medium", "high", "critical"]).describe("Task complexity level"),
    estimatedTime: z.string().optional().describe("Estimated completion time (e.g. '2-3 minutes')"),
  }),
  outputSchema: z.object({
    planId: z.string(),
    task: z.string(),
    steps: z.array(z.object({
      id: z.number(),
      action: z.string(),
      tool: z.string(),
      status: z.string(),
    })),
    complexity: z.string(),
    estimatedTime: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ task, steps, complexity, estimatedTime }) => {
    const planId = `plan-${++planCounter}-${Date.now()}`;

    const plan = {
      id: planId,
      task,
      steps: steps.map((s: { action: string; tool: string }, i: number) => ({
        id: i + 1,
        action: s.action,
        tool: s.tool,
        status: "pending" as const,
      })),
      status: "draft" as const,
      createdAt: Date.now(),
    };

    activePlans.set(planId, plan);

    return {
      planId,
      task,
      steps: plan.steps,
      complexity,
      estimatedTime: estimatedTime || "Unknown",
      message: `📋 Plan created with ${steps.length} steps. Present this to the user and ask for approval before executing.`,
    };
  },
});

/**
 * execute-plan-step — Execute a single step from an approved plan
 */
export const executePlanStepTool = createTool({
  id: "execute-plan-step",
  description: `Mark a plan step as started/completed/failed. Use this to track progress through a plan.
Call this BEFORE and AFTER executing each step's tool. This helps maintain execution state.
- Before executing: call with status "running"
- After success: call with status "done" and the result
- After failure: call with status "failed" and the error`,
  inputSchema: z.object({
    planId: z.string().describe("The plan ID from create-plan"),
    stepId: z.number().describe("Step number to update"),
    status: z.enum(["running", "done", "failed", "skipped"]).describe("New status for this step"),
    result: z.string().optional().describe("Result or output of the step"),
    error: z.string().optional().describe("Error message if failed"),
  }),
  outputSchema: z.object({
    planId: z.string(),
    stepId: z.number(),
    status: z.string(),
    progress: z.string(),
    nextStep: z.number().nullable(),
    message: z.string(),
  }),
  execute: async ({ planId, stepId, status, result, error }) => {
    const plan = activePlans.get(planId);

    if (!plan) {
      return {
        planId,
        stepId,
        status: "error",
        progress: "0/0",
        nextStep: null,
        message: `❌ Plan ${planId} not found. Create a new plan first.`,
      };
    }

    // Update step
    const step = plan.steps.find(s => s.id === stepId);
    if (step) {
      step.status = status;
      if (result) step.result = result;
      if (error) step.error = error;
    }

    // Update plan status
    if (status === "running" && plan.status === "draft") {
      plan.status = "approved";
    }
    if (plan.status !== "executing") {
      plan.status = "executing";
    }

    // Check completion
    const done = plan.steps.filter(s => s.status === "done").length;
    const failed = plan.steps.filter(s => s.status === "failed").length;
    const total = plan.steps.length;
    const progress = `${done}/${total}`;

    const nextStep = plan.steps.find(s => s.status === "pending");
    const nextStepId = nextStep ? nextStep.id : null;

    if (done + failed === total) {
      plan.status = failed > 0 ? "failed" : "completed";
      plan.completedAt = Date.now();
    }

    return {
      planId,
      stepId,
      status,
      progress,
      nextStep: nextStepId,
      message: status === "failed"
        ? `⚠️ Step ${stepId} failed: ${error || "Unknown error"}. Try an alternative approach or skip this step.`
        : status === "done"
          ? `✅ Step ${stepId} complete (${progress}). ${nextStepId ? `Next: Step ${nextStepId}` : "All steps done!"}`
          : `🔄 Step ${stepId} ${status}...`,
    };
  },
});

/**
 * review-output — Point 6: Self-Review Agent
 */
export const reviewOutputTool = createTool({
  id: "review-output",
  description: `Review your own output quality before presenting to the user. Use this after completing a complex task.
Check for: completeness, correctness, code quality, missing files, error handling.
Be HONEST — if something is wrong, say so and fix it.`,
  inputSchema: z.object({
    task: z.string().describe("The original task the user asked for"),
    output: z.string().describe("What you produced (summary of files created, code written, etc.)"),
    filesCreated: z.array(z.string()).optional().describe("List of files created/modified"),
    checkPoints: z.array(z.string()).optional().describe("Specific things to verify"),
  }),
  outputSchema: z.object({
    quality: z.string(),
    issues: z.array(z.string()),
    suggestions: z.array(z.string()),
    passed: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ task, output, filesCreated, checkPoints }) => {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!output || output.length < 10) {
      issues.push("Output is empty or too short");
    }

    if (filesCreated && filesCreated.length > 0) {
      const fs = await import("fs");
      for (const file of filesCreated) {
        try {
          if (!fs.existsSync(file)) {
            issues.push(`File not found: ${file}`);
          }
        } catch {
          issues.push(`Cannot verify file: ${file}`);
        }
      }
    }

    const taskWords = task.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    const outputLower = output.toLowerCase();
    const unaddressed = taskWords.filter((w: string) => !outputLower.includes(w));
    if (unaddressed.length > taskWords.length * 0.5) {
      suggestions.push("Output may not fully address the task — some key terms from the request are missing");
    }

    if (checkPoints) {
      for (const cp of checkPoints) {
        if (!outputLower.includes(cp.toLowerCase().split(/\s+/)[0])) {
          suggestions.push(`Checkpoint not verified: ${cp}`);
        }
      }
    }

    const quality = issues.length === 0 && suggestions.length === 0
      ? "excellent"
      : issues.length === 0
        ? "good"
        : issues.length <= 2
          ? "acceptable"
          : "needs-improvement";

    return {
      quality,
      issues,
      suggestions,
      passed: issues.length === 0,
      message: issues.length === 0
        ? `✅ Review passed (${quality}). Output looks good.`
        : `⚠️ Review found ${issues.length} issue(s): ${issues.join(", ")}. Consider fixing before presenting.`,
    };
  },
});

/**
 * get-plan-status — Check current plan status
 */
export const getPlanStatusTool = createTool({
  id: "get-plan-status",
  description: "Check the status of an active plan. Shows which steps are done, running, or pending.",
  inputSchema: z.object({
    planId: z.string().describe("The plan ID to check"),
  }),
  outputSchema: z.object({
    planId: z.string(),
    task: z.string(),
    status: z.string(),
    steps: z.array(z.object({
      id: z.number(),
      action: z.string(),
      tool: z.string(),
      status: z.string(),
    })),
    progress: z.string(),
    message: z.string(),
  }),
  execute: async ({ planId }) => {
    const plan = activePlans.get(planId);
    if (!plan) {
      return {
        planId,
        task: "Unknown",
        status: "not-found",
        steps: [],
        progress: "0/0",
        message: `❌ Plan ${planId} not found.`,
      };
    }

    const done = plan.steps.filter(s => s.status === "done").length;
    const total = plan.steps.length;

    return {
      planId: plan.id,
      task: plan.task,
      status: plan.status,
      steps: plan.steps.map(s => ({
        id: s.id,
        action: s.action,
        tool: s.tool,
        status: s.status,
      })),
      progress: `${done}/${total}`,
      message: `Plan "${plan.task}" — ${done}/${total} steps complete (${plan.status})`,
    };
  },
});
