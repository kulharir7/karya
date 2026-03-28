/**
 * Karya Heartbeat System — Proactive scheduled agent tasks
 * 
 * REWRITTEN in Phase 5.4 to actually work:
 * - Parses workspace/HEARTBEAT.md for task definitions
 * - Registers each task with the scheduler or runs on its own timer
 * - Executes tasks via TriggerExecutor → ChatProcessor
 * - File watcher: auto-reloads when HEARTBEAT.md changes
 * - State tracking: last run times persisted in heartbeat-state.json
 * - Smart scheduling: "at 09:00", "every 30 minutes", "daily", etc.
 * 
 * HEARTBEAT.md format:
 * ```markdown
 * ## Task Name
 * - schedule: every 30 minutes
 * - prompt: Check for important emails
 * - enabled: true
 * ```
 * 
 * Architecture:
 *   HEARTBEAT.md → parse → HeartbeatManager → timer per task
 *   Timer fires → executeHeartbeat() → processChatSync() → Agent
 *   Results logged in heartbeat-state.json + daily memory
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";
import { eventBus } from "./event-bus";
import { executeHeartbeat } from "./trigger-executor";

// ============================================
// TYPES
// ============================================

export interface HeartbeatTask {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
}

export interface HeartbeatTaskState {
  lastRunAt: number | null;
  nextRunAt: number | null;
  runCount: number;
  lastError: string | null;
  lastSuccess: boolean;
}

interface HeartbeatState {
  tasks: Record<string, HeartbeatTaskState>;
  lastReload: number;
}

// ============================================
// CONSTANTS
// ============================================

const HEARTBEAT_FILE = "HEARTBEAT.md";
const STATE_FILE = "heartbeat-state.json";
const CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds

// ============================================
// HEARTBEAT MANAGER
// ============================================

export class HeartbeatManager {
  private workspacePath: string;
  private tasks: HeartbeatTask[] = [];
  private state: HeartbeatState = { tasks: {}, lastReload: 0 };
  private timers = new Map<string, NodeJS.Timeout>();
  private checkTimer: NodeJS.Timeout | null = null;
  private fileWatcher: fs.FSWatcher | null = null;
  private running = false;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  // ---- LIFECYCLE ----

  /**
   * Start the heartbeat system.
   * Parses HEARTBEAT.md, loads state, starts timers.
   */
  start(): void {
    if (this.running) return;

    // Create default HEARTBEAT.md if it doesn't exist
    this.ensureHeartbeatFile();

    // Load state from disk
    this.loadState();

    // Parse and schedule tasks
    this.reload();

    // Watch HEARTBEAT.md for changes (auto-reload)
    this.watchFile();

    // Periodic check for due tasks (backup for timer drift)
    this.checkTimer = setInterval(() => this.checkDueTasks(), CHECK_INTERVAL_MS);
    if (this.checkTimer.unref) this.checkTimer.unref();

    this.running = true;
    const enabledCount = this.tasks.filter((t) => t.enabled).length;
    logger.info("heartbeat", `Started: ${this.tasks.length} tasks (${enabledCount} enabled)`);
  }

  /**
   * Stop the heartbeat system.
   */
  stop(): void {
    if (!this.running) return;

    // Clear all task timers
    for (const [id, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Clear check timer
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    // Stop file watcher
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }

    this.running = false;
    logger.info("heartbeat", "Stopped");
  }

  /**
   * Reload tasks from HEARTBEAT.md.
   * Called on start and when the file changes.
   */
  reload(): void {
    // Clear existing timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Parse file
    this.tasks = this.parseFile();
    this.state.lastReload = Date.now();

    // Initialize state for new tasks
    for (const task of this.tasks) {
      if (!this.state.tasks[task.id]) {
        this.state.tasks[task.id] = {
          lastRunAt: null,
          nextRunAt: null,
          runCount: 0,
          lastError: null,
          lastSuccess: true,
        };
      }
    }

    // Schedule enabled tasks
    for (const task of this.tasks) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }

    this.saveState();
    const enabledCount = this.tasks.filter((t) => t.enabled).length;
    logger.info("heartbeat", `Reloaded: ${this.tasks.length} tasks (${enabledCount} enabled)`);
  }

  // ---- SCHEDULING ----

  private scheduleTask(task: HeartbeatTask): void {
    const taskState = this.state.tasks[task.id];
    const now = Date.now();
    const nextRun = this.calculateNextRun(task.schedule, taskState?.lastRunAt || null);

    // Update state
    if (taskState) {
      taskState.nextRunAt = nextRun;
    }

    const delay = Math.max(0, nextRun - now);

    logger.info(
      "heartbeat",
      `Scheduled "${task.name}": ${delay < 60000 ? `${Math.ceil(delay / 1000)}s` : `${Math.ceil(delay / 60000)}m`}`
    );

    const timer = setTimeout(async () => {
      await this.runTask(task);
      // Re-schedule for next occurrence
      if (task.enabled && this.running) {
        this.scheduleTask(task);
      }
    }, delay);

    if (timer.unref) timer.unref();
    this.timers.set(task.id, timer);
  }

  /**
   * Calculate next run time from a schedule string.
   * 
   * Supported formats:
   * - "every 30 minutes" / "every 2 hours" / "every 1 day"
   * - "at 09:00" / "at 17:30" (daily at specific time)
   * - "hourly" / "daily" / "weekly"
   * - "every-5-minutes" / "every-30-minutes" (scheduler-style)
   */
  private calculateNextRun(schedule: string, lastRunAt: number | null): number {
    const now = Date.now();
    const s = schedule.toLowerCase().trim();

    // "every N minutes/hours/days"
    const everyMatch = s.match(/every\s+(\d+)\s*(minute|hour|day)s?/);
    if (everyMatch) {
      const amount = parseInt(everyMatch[1]);
      const unit = everyMatch[2];
      const ms = unit === "minute" ? amount * 60_000
               : unit === "hour" ? amount * 3600_000
               : amount * 86400_000;

      if (lastRunAt && lastRunAt + ms > now) {
        return lastRunAt + ms;
      }
      return now + ms;
    }

    // Scheduler-style: "every-5-minutes", "every-30-minutes"
    const dashMatch = s.match(/every-(\d+)-(minute|hour)s?/);
    if (dashMatch) {
      const amount = parseInt(dashMatch[1]);
      const unit = dashMatch[2];
      const ms = unit === "minute" ? amount * 60_000 : amount * 3600_000;
      if (lastRunAt && lastRunAt + ms > now) {
        return lastRunAt + ms;
      }
      return now + ms;
    }

    // "at HH:MM" (daily)
    const atMatch = s.match(/at\s+(\d{1,2}):(\d{2})/);
    if (atMatch) {
      const hour = parseInt(atMatch[1]);
      const minute = parseInt(atMatch[2]);
      const target = new Date();
      target.setHours(hour, minute, 0, 0);

      if (target.getTime() <= now) {
        // Already passed today → tomorrow
        target.setDate(target.getDate() + 1);
      }

      return target.getTime();
    }

    // Named schedules
    switch (s) {
      case "hourly":
        return lastRunAt ? lastRunAt + 3600_000 : now + 3600_000;
      case "daily":
        return lastRunAt ? lastRunAt + 86400_000 : now + 86400_000;
      case "weekly":
        return lastRunAt ? lastRunAt + 604800_000 : now + 604800_000;
      default:
        // Default: 1 hour
        return now + 3600_000;
    }
  }

  // ---- EXECUTION ----

  private async runTask(task: HeartbeatTask): Promise<void> {
    const taskState = this.state.tasks[task.id];
    if (!taskState) return;

    logger.info("heartbeat", `Running: "${task.name}"`);
    await eventBus.emit("heartbeat:task", { taskId: task.id, name: task.name, prompt: task.prompt });

    try {
      const result = await executeHeartbeat(task.id, task.name, task.prompt);

      taskState.lastRunAt = Date.now();
      taskState.runCount++;
      taskState.lastSuccess = result.success;
      taskState.lastError = result.error || null;

      if (result.success) {
        logger.info("heartbeat", `Completed: "${task.name}" (${result.durationMs}ms, ${result.toolCalls} tools)`);
      } else {
        logger.warn("heartbeat", `Failed: "${task.name}": ${result.error}`);
      }
    } catch (err: any) {
      taskState.lastRunAt = Date.now();
      taskState.runCount++;
      taskState.lastSuccess = false;
      taskState.lastError = err.message;
      logger.error("heartbeat", `Error running "${task.name}": ${err.message}`);
    }

    this.saveState();
  }

  /**
   * Backup check — catches tasks that were missed due to timer drift.
   */
  private checkDueTasks(): void {
    const now = Date.now();

    for (const task of this.tasks) {
      if (!task.enabled) continue;

      const taskState = this.state.tasks[task.id];
      if (!taskState?.nextRunAt) continue;

      // If nextRunAt is past and no timer is running for this task
      if (taskState.nextRunAt <= now && !this.timers.has(task.id)) {
        logger.info("heartbeat", `Backup trigger: "${task.name}" (missed timer)`);
        this.scheduleTask(task);
      }
    }
  }

  // ---- FILE PARSING ----

  /**
   * Parse HEARTBEAT.md into task definitions.
   * 
   * Format:
   * ```markdown
   * ## Task Name
   * - schedule: every 30 minutes
   * - prompt: Do something
   * - enabled: true
   * ```
   */
  private parseFile(): HeartbeatTask[] {
    const filePath = path.join(this.workspacePath, HEARTBEAT_FILE);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const tasks: HeartbeatTask[] = [];

    // Split by ## headers
    const sections = content.split(/^## /m).slice(1);

    for (const section of sections) {
      const lines = section.trim().split("\n");
      const name = lines[0].trim();

      if (!name) continue;

      const id = `hb-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

      let schedule = "";
      let prompt = "";
      let enabled = false;

      for (const line of lines.slice(1)) {
        const match = line.match(/^-\s*(\w+):\s*(.+)$/);
        if (!match) continue;

        const [, key, value] = match;
        const val = value.trim();

        switch (key.toLowerCase()) {
          case "schedule":
            schedule = val;
            break;
          case "prompt":
            prompt = val;
            break;
          case "enabled":
            enabled = val.toLowerCase() === "true" || val === "1" || val === "yes";
            break;
        }
      }

      // Multi-line prompt: if no inline prompt, check for paragraph after metadata
      if (!prompt) {
        const promptLines: string[] = [];
        let pastMetadata = false;
        for (const line of lines.slice(1)) {
          if (line.match(/^-\s*\w+:/)) {
            pastMetadata = true;
            continue;
          }
          if (pastMetadata && line.trim()) {
            promptLines.push(line.trim());
          }
        }
        prompt = promptLines.join(" ");
      }

      if (schedule && prompt) {
        tasks.push({ id, name, schedule, prompt, enabled });
      }
    }

    return tasks;
  }

  // ---- FILE WATCHING ----

  private watchFile(): void {
    const filePath = path.join(this.workspacePath, HEARTBEAT_FILE);

    if (!fs.existsSync(filePath)) return;

    try {
      // Debounce: don't reload more than once per 2 seconds
      let debounceTimer: NodeJS.Timeout | null = null;

      this.fileWatcher = fs.watch(filePath, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          logger.info("heartbeat", "HEARTBEAT.md changed, reloading...");
          this.reload();
        }, 2000);
      });

      this.fileWatcher.on("error", () => {
        // File might be deleted/renamed — stop watching
      });
    } catch {
      logger.warn("heartbeat", "Failed to watch HEARTBEAT.md");
    }
  }

  // ---- STATE PERSISTENCE ----

  private loadState(): void {
    const statePath = path.join(this.workspacePath, STATE_FILE);

    try {
      if (fs.existsSync(statePath)) {
        const content = fs.readFileSync(statePath, "utf-8");
        this.state = JSON.parse(content);
      }
    } catch {
      logger.warn("heartbeat", "Failed to load state, starting fresh");
      this.state = { tasks: {}, lastReload: 0 };
    }
  }

  private saveState(): void {
    const statePath = path.join(this.workspacePath, STATE_FILE);

    try {
      fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2), "utf-8");
    } catch {
      logger.warn("heartbeat", "Failed to save state");
    }
  }

  // ---- DEFAULT FILE ----

  private ensureHeartbeatFile(): void {
    const filePath = path.join(this.workspacePath, HEARTBEAT_FILE);

    if (fs.existsSync(filePath)) return;

    const content = `# Karya Heartbeat — Proactive Agent Tasks

Karya runs these tasks automatically on schedule.
Edit this file to add/change/remove tasks.

Changes are detected automatically — no restart needed!

---

## System Health Check
- schedule: every 2 hours
- prompt: Check system health: CPU, memory, disk usage. Alert if anything is above 90%.
- enabled: false

## Daily Briefing
- schedule: at 09:00
- prompt: Good morning! Give me a brief summary of today's date, any scheduled tasks, and recent activity.
- enabled: false

## Git Status Check
- schedule: every 4 hours
- prompt: Check git status for projects in F:\\ drive. Report any uncommitted changes or unsynced branches.
- enabled: false

## Downloads Cleanup Reminder
- schedule: daily
- prompt: Check my Downloads folder. If there are more than 20 files, suggest which ones to organize or delete.
- enabled: false

## Memory Review
- schedule: weekly
- prompt: Review the daily memory logs from the past week. Summarize key events and update MEMORY.md with important learnings.
- enabled: false

---

**To activate a task:** Change \`enabled: false\` to \`enabled: true\`

**Schedule formats:**
- \`every 30 minutes\` — run every 30 minutes
- \`every 2 hours\` — run every 2 hours
- \`at 09:00\` — run daily at 9:00 AM
- \`at 17:30\` — run daily at 5:30 PM
- \`hourly\` — run once per hour
- \`daily\` — run once per day
- \`weekly\` — run once per week
`;

    try {
      fs.writeFileSync(filePath, content, "utf-8");
      logger.info("heartbeat", "Created default HEARTBEAT.md");
    } catch {
      logger.warn("heartbeat", "Failed to create HEARTBEAT.md");
    }
  }

  // ---- STATUS ----

  /**
   * Get full heartbeat status.
   */
  getStatus(): {
    running: boolean;
    tasks: Array<HeartbeatTask & HeartbeatTaskState & { nextRunHuman: string }>;
    taskCount: number;
    enabledCount: number;
    totalRuns: number;
  } {
    const now = Date.now();
    const enrichedTasks = this.tasks.map((task) => {
      const state = this.state.tasks[task.id] || {
        lastRunAt: null,
        nextRunAt: null,
        runCount: 0,
        lastError: null,
        lastSuccess: true,
      };

      const nextRunAt = state.nextRunAt || this.calculateNextRun(task.schedule, state.lastRunAt);
      const diffMs = nextRunAt - now;
      let nextRunHuman = "";

      if (diffMs <= 0) {
        nextRunHuman = "due now";
      } else if (diffMs < 60_000) {
        nextRunHuman = `in ${Math.ceil(diffMs / 1000)}s`;
      } else if (diffMs < 3600_000) {
        nextRunHuman = `in ${Math.ceil(diffMs / 60_000)}m`;
      } else {
        nextRunHuman = `in ${Math.round(diffMs / 3600_000 * 10) / 10}h`;
      }

      return {
        ...task,
        ...state,
        nextRunAt,
        nextRunHuman: task.enabled ? nextRunHuman : "disabled",
      };
    });

    return {
      running: this.running,
      tasks: enrichedTasks,
      taskCount: this.tasks.length,
      enabledCount: this.tasks.filter((t) => t.enabled).length,
      totalRuns: Object.values(this.state.tasks).reduce((sum, s) => sum + s.runCount, 0),
    };
  }

  /**
   * Manually run a task by ID.
   */
  async runTaskById(taskId: string): Promise<{ success: boolean; error?: string }> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return { success: false, error: "Task not found" };
    await this.runTask(task);
    return { success: true };
  }
}

// ============================================
// SINGLETON
// ============================================

let instance: HeartbeatManager | null = null;

export function getHeartbeatManager(workspacePath?: string): HeartbeatManager {
  if (!instance) {
    instance = new HeartbeatManager(
      workspacePath || path.join(process.cwd(), "workspace")
    );
  }
  return instance;
}

/**
 * Start heartbeat system. Safe to call multiple times.
 */
export function startHeartbeat(workspacePath?: string): HeartbeatManager {
  const mgr = getHeartbeatManager(workspacePath);
  mgr.start();
  return mgr;
}

/**
 * Stop heartbeat system.
 */
export function stopHeartbeat(): void {
  if (instance) {
    instance.stop();
  }
}
