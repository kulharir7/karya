import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  createTask, listTasks, toggleTask, deleteTask, runTaskNow,
} from "@/lib/scheduler";

/**
 * Schedule a new task — recurring or one-shot.
 */
export const scheduleTaskTool = createTool({
  id: "task-schedule",
  description:
    "Schedule a new automated task. Use for: reminders, recurring checks, periodic backups, " +
    "daily reports, or any timed automation. " +
    "Types: 'once' (run once at specific time), 'interval' (repeat every N ms), " +
    "'cron' (daily/hourly/weekly schedule).",
  inputSchema: z.object({
    name: z.string().describe("Human-readable name (e.g., 'Daily Backup', 'Check Email')"),
    type: z.enum(["once", "interval", "cron"]).describe("Task type: 'once', 'interval', or 'cron'"),
    task: z.string().describe("The instruction to execute (sent to agent as a message)"),
    intervalMs: z.number().optional().describe("For interval: repeat every N milliseconds (e.g., 3600000 = 1 hour)"),
    cronExpr: z.string().optional().describe("For cron: 'hourly', 'daily', 'weekly', 'every-5-minutes', 'every-30-minutes'"),
    delayMinutes: z.number().optional().describe("For once: delay in minutes from now (e.g., 30 = run in 30 minutes)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    taskId: z.string(),
    name: z.string(),
    nextRunAt: z.string(),
  }),
  execute: async ({ name, type, task, intervalMs, cronExpr, delayMinutes }) => {
    let runAt: number | undefined;
    if (type === "once" && delayMinutes) {
      runAt = Date.now() + delayMinutes * 60 * 1000;
    }

    const created = await createTask({
      name, type, task,
      intervalMs, cronExpr, runAt,
    });

    return {
      success: true,
      taskId: created.id,
      name: created.name,
      nextRunAt: created.nextRunAt
        ? new Date(created.nextRunAt).toLocaleString("en-IN")
        : "immediately",
    };
  },
});

/**
 * List all scheduled tasks.
 */
export const listTasksTool = createTool({
  id: "task-list",
  description: "List all scheduled/automated tasks with their status, next run time, and run count.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    tasks: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      enabled: z.boolean(),
      runCount: z.number(),
      nextRun: z.string(),
      lastRun: z.string(),
    })),
    count: z.number(),
  }),
  execute: async () => {
    const tasks = await listTasks();
    return {
      success: true,
      tasks: tasks.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        enabled: t.enabled,
        runCount: t.runCount,
        nextRun: t.nextRunAt ? new Date(t.nextRunAt).toLocaleString("en-IN") : "N/A",
        lastRun: t.lastRunAt ? new Date(t.lastRunAt).toLocaleString("en-IN") : "Never",
      })),
      count: tasks.length,
    };
  },
});

/**
 * Cancel/delete a scheduled task.
 */
export const cancelTaskTool = createTool({
  id: "task-cancel",
  description: "Cancel and delete a scheduled task by its ID. Use task-list to find task IDs.",
  inputSchema: z.object({
    taskId: z.string().describe("The task ID to cancel"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ taskId }) => {
    await deleteTask(taskId);
    return { success: true, message: `Task ${taskId} cancelled and deleted` };
  },
});
