/**
 * Karya Proactive Heartbeat
 * 
 * HEARTBEAT.md defines scheduled proactive behaviors:
 * - Morning briefings
 * - Hourly monitoring checks
 * - Weekly reports
 * 
 * The agent is triggered at scheduled times to perform
 * proactive actions without user prompts.
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";
import { eventBus } from "./event-bus";

const HEARTBEAT_FILE = "HEARTBEAT.md";

export interface HeartbeatTask {
  id: string;
  schedule: string;        // cron expression or "every X minutes"
  prompt: string;          // what to tell the agent
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export interface HeartbeatConfig {
  tasks: HeartbeatTask[];
  timezone?: string;
  enabled: boolean;
}

/**
 * Parse HEARTBEAT.md to extract scheduled tasks
 */
export function parseHeartbeatFile(workspacePath: string): HeartbeatConfig {
  const heartbeatPath = path.join(workspacePath, HEARTBEAT_FILE);
  
  if (!fs.existsSync(heartbeatPath)) {
    return { tasks: [], enabled: false };
  }

  const content = fs.readFileSync(heartbeatPath, "utf-8");
  const tasks: HeartbeatTask[] = [];

  // Parse markdown format:
  // ## Task Name
  // - schedule: every 30 minutes
  // - prompt: Check for new emails
  // - enabled: true

  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.trim().split("\n");
    const name = lines[0].trim();
    
    const task: Partial<HeartbeatTask> = {
      id: name.toLowerCase().replace(/\s+/g, "-"),
    };

    for (const line of lines.slice(1)) {
      const match = line.match(/^-\s*(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        if (key === "schedule") task.schedule = value.trim();
        if (key === "prompt") task.prompt = value.trim();
        if (key === "enabled") task.enabled = value.trim().toLowerCase() === "true";
      }
    }

    if (task.schedule && task.prompt) {
      tasks.push(task as HeartbeatTask);
    }
  }

  return {
    tasks,
    enabled: tasks.some(t => t.enabled),
  };
}

/**
 * Calculate next run time from schedule string
 */
export function calculateNextRun(schedule: string, lastRun?: number): number {
  const now = Date.now();
  
  // Parse "every X minutes/hours"
  const everyMatch = schedule.match(/every\s+(\d+)\s*(minute|hour|day)s?/i);
  if (everyMatch) {
    const [, amount, unit] = everyMatch;
    const multiplier = unit.toLowerCase().startsWith("minute") ? 60 * 1000
                     : unit.toLowerCase().startsWith("hour") ? 60 * 60 * 1000
                     : 24 * 60 * 60 * 1000;
    
    const interval = parseInt(amount) * multiplier;
    
    if (lastRun) {
      return lastRun + interval;
    }
    return now + interval;
  }

  // Parse "at HH:MM" or "HH:MM"
  const timeMatch = schedule.match(/(?:at\s+)?(\d{1,2}):(\d{2})/i);
  if (timeMatch) {
    const [, hour, minute] = timeMatch;
    const target = new Date();
    target.setHours(parseInt(hour), parseInt(minute), 0, 0);
    
    // If time already passed today, schedule for tomorrow
    if (target.getTime() < now) {
      target.setDate(target.getDate() + 1);
    }
    
    return target.getTime();
  }

  // Default: 1 hour from now
  return now + 60 * 60 * 1000;
}

/**
 * Get due heartbeat tasks
 */
export function getDueTasks(config: HeartbeatConfig): HeartbeatTask[] {
  const now = Date.now();
  
  return config.tasks.filter(task => {
    if (!task.enabled) return false;
    
    const nextRun = task.nextRun || calculateNextRun(task.schedule, task.lastRun);
    return nextRun <= now;
  });
}

/**
 * Heartbeat Manager
 */
export class HeartbeatManager {
  private workspacePath: string;
  private config: HeartbeatConfig;
  private timer: NodeJS.Timeout | null = null;
  private checkInterval: number = 60 * 1000; // Check every minute

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.config = parseHeartbeatFile(workspacePath);
  }

  /**
   * Start the heartbeat manager
   */
  start(): void {
    if (this.timer) return;

    logger.info("heartbeat", `Starting with ${this.config.tasks.length} tasks`);

    this.timer = setInterval(() => this.check(), this.checkInterval);
    
    // Initial check
    this.check();
  }

  /**
   * Stop the heartbeat manager
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info("heartbeat", "Stopped");
    }
  }

  /**
   * Check for due tasks
   */
  private check(): void {
    // Reload config (in case HEARTBEAT.md changed)
    this.config = parseHeartbeatFile(this.workspacePath);
    
    if (!this.config.enabled) return;

    const dueTasks = getDueTasks(this.config);
    
    for (const task of dueTasks) {
      this.triggerTask(task);
    }
  }

  /**
   * Trigger a heartbeat task
   */
  private triggerTask(task: HeartbeatTask): void {
    logger.info("heartbeat", `Triggering task: ${task.id}`);

    // Update last run
    task.lastRun = Date.now();
    task.nextRun = calculateNextRun(task.schedule, task.lastRun);

    // Emit event for agent to handle
    eventBus.emit("heartbeat:task", {
      taskId: task.id,
      prompt: task.prompt,
      timestamp: Date.now(),
    });
  }

  /**
   * Get task status
   */
  getStatus(): { enabled: boolean; tasks: HeartbeatTask[]; nextDue: number | null } {
    const now = Date.now();
    let nextDue: number | null = null;

    for (const task of this.config.tasks) {
      if (!task.enabled) continue;
      
      const next = task.nextRun || calculateNextRun(task.schedule, task.lastRun);
      if (nextDue === null || next < nextDue) {
        nextDue = next;
      }
    }

    return {
      enabled: this.config.enabled,
      tasks: this.config.tasks,
      nextDue,
    };
  }

  /**
   * Reload configuration
   */
  reload(): void {
    this.config = parseHeartbeatFile(this.workspacePath);
    logger.info("heartbeat", `Reloaded: ${this.config.tasks.length} tasks`);
  }
}

// Singleton
let heartbeatInstance: HeartbeatManager | null = null;

export function getHeartbeatManager(workspacePath?: string): HeartbeatManager {
  if (!heartbeatInstance) {
    heartbeatInstance = new HeartbeatManager(
      workspacePath || path.join(process.cwd(), "workspace")
    );
  }
  return heartbeatInstance;
}

/**
 * Create default HEARTBEAT.md
 */
export function createDefaultHeartbeat(workspacePath: string): void {
  const heartbeatPath = path.join(workspacePath, HEARTBEAT_FILE);
  
  if (fs.existsSync(heartbeatPath)) return;

  const content = `# Karya Heartbeat — Proactive Tasks

Define scheduled tasks here. Karya will run these automatically.

---

## Morning Briefing
- schedule: at 09:00
- prompt: Good morning! Summarize my schedule for today and any pending tasks.
- enabled: false

## Hourly Email Check
- schedule: every 60 minutes
- prompt: Check for important unread emails and summarize if any.
- enabled: false

## URL Monitor
- schedule: every 30 minutes
- prompt: Check monitored URLs for changes (see TOOLS.md for list).
- enabled: false

## Weekly Review
- schedule: at 17:00
- prompt: It's Friday evening. Generate a weekly summary of completed tasks.
- enabled: false

---

**Note:** Set \`enabled: true\` to activate a task.
`;

  fs.writeFileSync(heartbeatPath, content, "utf-8");
  logger.info("heartbeat", "Created default HEARTBEAT.md");
}
