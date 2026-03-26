/**
 * Karya Task Scheduler — Cron-style recurring tasks + one-shot timers.
 * 
 * Like OpenClaw's cron system:
 *   - Schedule recurring tasks (every N minutes/hours/days)
 *   - One-shot delayed tasks ("remind me in 20 minutes")
 *   - Persistent across restarts (saved to SQLite)
 *   - Tasks execute via the agent (sends message to chat API)
 */

import { createClient, type Client } from "@libsql/client";
import * as path from "path";
import { eventBus } from "./event-bus";

export interface ScheduledTask {
  id: string;
  name: string;
  type: "interval" | "cron" | "once";
  // For interval: run every N milliseconds
  intervalMs?: number;
  // For cron: cron expression (simplified: "daily", "hourly", "weekly")
  cronExpr?: string;
  // For once: run at this timestamp
  runAt?: number;
  // The task to execute (sent as a message to the agent)
  task: string;
  enabled: boolean;
  createdAt: number;
  lastRunAt: number | null;
  nextRunAt: number | null;
  runCount: number;
  status: "active" | "paused" | "completed" | "error";
  lastError?: string;
}

// Active timers
const activeTimers: Map<string, NodeJS.Timeout> = new Map();
let db: Client | null = null;
let initialized = false;

function getDB(): Client {
  if (!db) {
    const dbPath = path.join(process.cwd(), "karya-scheduler.db");
    db = createClient({ url: `file:${dbPath}` });
  }
  return db;
}

export async function initScheduler(): Promise<void> {
  if (initialized) return;
  const client = getDB();

  await client.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      intervalMs INTEGER,
      cronExpr TEXT,
      runAt INTEGER,
      task TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      lastRunAt INTEGER,
      nextRunAt INTEGER,
      runCount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      lastError TEXT
    )
  `);

  initialized = true;

  // Start all active tasks
  const tasks = await listTasks();
  for (const task of tasks) {
    if (task.enabled && task.status === "active") {
      scheduleTaskTimer(task);
    }
  }

  await eventBus.emit("system:ready", { scheduler: true, taskCount: tasks.length });
}

// ─── CRUD ───

export async function createTask(params: {
  name: string;
  type: "interval" | "cron" | "once";
  intervalMs?: number;
  cronExpr?: string;
  runAt?: number;
  task: string;
}): Promise<ScheduledTask> {
  await initScheduler();
  const now = Date.now();
  const id = `task-${now}-${Math.random().toString(36).slice(2, 6)}`;

  let nextRunAt: number | null = null;
  if (params.type === "once" && params.runAt) {
    nextRunAt = params.runAt;
  } else if (params.type === "interval" && params.intervalMs) {
    nextRunAt = now + params.intervalMs;
  } else if (params.type === "cron" && params.cronExpr) {
    nextRunAt = calculateNextCron(params.cronExpr, now);
  }

  const task: ScheduledTask = {
    id,
    name: params.name,
    type: params.type,
    intervalMs: params.intervalMs,
    cronExpr: params.cronExpr,
    runAt: params.runAt,
    task: params.task,
    enabled: true,
    createdAt: now,
    lastRunAt: null,
    nextRunAt,
    runCount: 0,
    status: "active",
  };

  await getDB().execute({
    sql: `INSERT INTO tasks (id, name, type, intervalMs, cronExpr, runAt, task, enabled, createdAt, lastRunAt, nextRunAt, runCount, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, NULL, ?, 0, 'active')`,
    args: [id, task.name, task.type, task.intervalMs || null, task.cronExpr || null, task.runAt || null, task.task, now, nextRunAt],
  });

  scheduleTaskTimer(task);
  return task;
}

export async function listTasks(): Promise<ScheduledTask[]> {
  await initScheduler();
  const result = await getDB().execute(`SELECT * FROM tasks WHERE status != 'completed' ORDER BY createdAt DESC`);
  return result.rows.map(rowToTask);
}

export async function getTask(id: string): Promise<ScheduledTask | null> {
  await initScheduler();
  const result = await getDB().execute({ sql: `SELECT * FROM tasks WHERE id = ?`, args: [id] });
  if (result.rows.length === 0) return null;
  return rowToTask(result.rows[0]);
}

export async function toggleTask(id: string): Promise<ScheduledTask | null> {
  await initScheduler();
  const task = await getTask(id);
  if (!task) return null;

  const newEnabled = !task.enabled;
  await getDB().execute({
    sql: `UPDATE tasks SET enabled = ? WHERE id = ?`,
    args: [newEnabled ? 1 : 0, id],
  });

  if (newEnabled) {
    task.enabled = true;
    scheduleTaskTimer(task);
  } else {
    cancelTaskTimer(id);
    task.enabled = false;
  }

  return { ...task, enabled: newEnabled };
}

export async function deleteTask(id: string): Promise<void> {
  await initScheduler();
  cancelTaskTimer(id);
  await getDB().execute({ sql: `DELETE FROM tasks WHERE id = ?`, args: [id] });
}

export async function runTaskNow(id: string): Promise<{ success: boolean; error?: string }> {
  const task = await getTask(id);
  if (!task) return { success: false, error: "Task not found" };
  return executeTask(task);
}

// ─── Timer Management ───

function scheduleTaskTimer(task: ScheduledTask): void {
  cancelTaskTimer(task.id);

  if (!task.enabled || task.status !== "active") return;

  if (task.type === "once" && task.runAt) {
    const delay = Math.max(0, task.runAt - Date.now());
    const timer = setTimeout(async () => {
      await executeTask(task);
      await getDB().execute({ sql: `UPDATE tasks SET status = 'completed' WHERE id = ?`, args: [task.id] });
      activeTimers.delete(task.id);
    }, delay);
    activeTimers.set(task.id, timer);
  }

  if (task.type === "interval" && task.intervalMs) {
    const timer = setInterval(async () => {
      await executeTask(task);
    }, task.intervalMs);
    activeTimers.set(task.id, timer);
  }

  if (task.type === "cron" && task.cronExpr) {
    scheduleCronTick(task);
  }
}

function scheduleCronTick(task: ScheduledTask): void {
  if (!task.cronExpr) return;
  const nextRun = calculateNextCron(task.cronExpr, Date.now());
  const delay = Math.max(1000, nextRun - Date.now());

  const timer = setTimeout(async () => {
    await executeTask(task);
    // Schedule next cron tick
    if (task.enabled && task.status === "active") {
      scheduleCronTick(task);
    }
  }, delay);
  activeTimers.set(task.id, timer);
}

function cancelTaskTimer(id: string): void {
  const timer = activeTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    clearInterval(timer);
    activeTimers.delete(id);
  }
}

// ─── Task Execution ───

async function executeTask(task: ScheduledTask): Promise<{ success: boolean; error?: string }> {
  const now = Date.now();

  try {
    await eventBus.emit("tool:before_call", { toolName: "scheduler", args: { taskId: task.id, task: task.task } });

    // Execute via internal agent call
    const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `[Scheduled Task: ${task.name}] ${task.task}`,
        sessionId: "default",
      }),
    });

    // Read the SSE stream to completion
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    // Update task record
    let nextRunAt: number | null = null;
    if (task.type === "interval" && task.intervalMs) {
      nextRunAt = now + task.intervalMs;
    } else if (task.type === "cron" && task.cronExpr) {
      nextRunAt = calculateNextCron(task.cronExpr, now);
    }

    await getDB().execute({
      sql: `UPDATE tasks SET lastRunAt = ?, nextRunAt = ?, runCount = runCount + 1, lastError = NULL WHERE id = ?`,
      args: [now, nextRunAt, task.id],
    });

    await eventBus.emit("tool:after_call", { toolName: "scheduler", result: { taskId: task.id, success: true } });
    return { success: true };
  } catch (err: any) {
    const errorMsg = err.message || "Task execution failed";
    await getDB().execute({
      sql: `UPDATE tasks SET lastRunAt = ?, lastError = ?, runCount = runCount + 1 WHERE id = ?`,
      args: [now, errorMsg, task.id],
    });
    return { success: false, error: errorMsg };
  }
}

// ─── Cron Expression Parser (simplified) ───

function calculateNextCron(expr: string, fromMs: number): number {
  const from = new Date(fromMs);
  const next = new Date(from);

  switch (expr.toLowerCase()) {
    case "every-minute":
      next.setMinutes(next.getMinutes() + 1, 0, 0);
      break;
    case "every-5-minutes":
      next.setMinutes(next.getMinutes() + 5 - (next.getMinutes() % 5), 0, 0);
      break;
    case "every-15-minutes":
      next.setMinutes(next.getMinutes() + 15 - (next.getMinutes() % 15), 0, 0);
      break;
    case "every-30-minutes":
    case "half-hourly":
      next.setMinutes(next.getMinutes() + 30 - (next.getMinutes() % 30), 0, 0);
      break;
    case "hourly":
      next.setHours(next.getHours() + 1, 0, 0, 0);
      break;
    case "every-2-hours":
      next.setHours(next.getHours() + 2, 0, 0, 0);
      break;
    case "every-6-hours":
      next.setHours(next.getHours() + 6 - (next.getHours() % 6), 0, 0, 0);
      break;
    case "daily":
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0); // Default: 9 AM
      break;
    case "weekly":
      next.setDate(next.getDate() + (7 - next.getDay()) + 1); // Next Monday
      next.setHours(9, 0, 0, 0);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1, 1);
      next.setHours(9, 0, 0, 0);
      break;
    default:
      // Fallback: 1 hour from now
      next.setHours(next.getHours() + 1, 0, 0, 0);
  }

  return next.getTime();
}

// ─── Helpers ───

function rowToTask(row: any): ScheduledTask {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as "interval" | "cron" | "once",
    intervalMs: row.intervalMs as number | undefined,
    cronExpr: row.cronExpr as string | undefined,
    runAt: row.runAt as number | undefined,
    task: row.task as string,
    enabled: (row.enabled as number) === 1,
    createdAt: row.createdAt as number,
    lastRunAt: row.lastRunAt as number | null,
    nextRunAt: row.nextRunAt as number | null,
    runCount: row.runCount as number,
    status: row.status as "active" | "paused" | "completed" | "error",
    lastError: row.lastError as string | undefined,
  };
}

/**
 * Get scheduler stats.
 */
export async function getSchedulerStats(): Promise<{
  totalTasks: number;
  activeTasks: number;
  activeTimers: number;
}> {
  await initScheduler();
  const tasks = await listTasks();
  return {
    totalTasks: tasks.length,
    activeTasks: tasks.filter((t) => t.enabled && t.status === "active").length,
    activeTimers: activeTimers.size,
  };
}
