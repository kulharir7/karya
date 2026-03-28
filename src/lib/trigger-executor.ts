/**
 * Trigger Executor — Connects triggers and scheduler to ChatProcessor
 * 
 * This is the MISSING LINK. Before this file:
 * - Triggers fired but used fetch("/api/chat") — fragile, localhost-dependent
 * - Scheduler did the same — fetch + read SSE stream to completion (wasteful)
 * 
 * Now:
 * - Both call processChatSync() directly — no HTTP, no SSE parsing, no localhost
 * - Each trigger/task gets its own session (isolated context)
 * - Results are logged to daily memory
 * - Errors are caught and stored
 * - Concurrent execution control (max 3 simultaneous)
 * - Cooldown per trigger (prevent rapid re-firing)
 * 
 * Architecture:
 *   Trigger fires → TriggerExecutor.execute() → processChatSync() → result logged
 *   Scheduler fires → TriggerExecutor.executeTask() → processChatSync() → DB updated
 */

import { processChatSync, type ChatResult } from "./chat-processor";
import { eventBus } from "./event-bus";
import { logger } from "./logger";

// ============================================
// TYPES
// ============================================

export interface ExecutionRequest {
  /** Unique identifier for this execution (trigger ID or task ID) */
  sourceId: string;
  /** Human-readable name */
  sourceName: string;
  /** Where this came from */
  sourceType: "trigger" | "scheduler" | "heartbeat" | "webhook";
  /** The message/instruction for the agent */
  message: string;
  /** Session to use (auto-generated if not provided) */
  sessionId?: string;
  /** Extra context data (trigger payload, webhook body, etc.) */
  context?: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  text: string;
  toolCalls: number;
  durationMs: number;
  error?: string;
}

// ============================================
// STATE
// ============================================

/** Currently running executions */
const activeExecutions = new Map<string, { startedAt: number; sourceType: string }>();

/** Max concurrent executions */
const MAX_CONCURRENT = 3;

/** Cooldown per source (prevent rapid re-firing) */
const cooldowns = new Map<string, number>();
const DEFAULT_COOLDOWN_MS = 5_000; // 5 seconds between same trigger fires

/** Execution history (last 100) */
const executionHistory: Array<{
  sourceId: string;
  sourceName: string;
  sourceType: string;
  success: boolean;
  durationMs: number;
  timestamp: number;
  error?: string;
}> = [];
const MAX_HISTORY = 100;

// ============================================
// MAIN EXECUTOR
// ============================================

/**
 * Execute a trigger/task/heartbeat through ChatProcessor.
 * 
 * This is the core function. Everything goes through here:
 * - File trigger fires → execute()
 * - Clipboard trigger fires → execute()
 * - Webhook received → execute()
 * - Scheduler task fires → execute()
 * - Heartbeat task fires → execute()
 */
export async function execute(request: ExecutionRequest): Promise<ExecutionResult> {
  const {
    sourceId,
    sourceName,
    sourceType,
    message,
    context,
  } = request;

  // ---- 1. Cooldown check ----
  const lastFired = cooldowns.get(sourceId);
  if (lastFired && Date.now() - lastFired < DEFAULT_COOLDOWN_MS) {
    logger.debug("executor", `Cooldown active for ${sourceName}, skipping`);
    return {
      success: false,
      text: "",
      toolCalls: 0,
      durationMs: 0,
      error: "Cooldown active",
    };
  }

  // ---- 2. Concurrency check ----
  if (activeExecutions.size >= MAX_CONCURRENT) {
    logger.warn("executor", `Max concurrent executions (${MAX_CONCURRENT}) reached, queuing ${sourceName}`);
    // Wait for a slot (with timeout)
    const waitStart = Date.now();
    while (activeExecutions.size >= MAX_CONCURRENT) {
      await new Promise((r) => setTimeout(r, 1000));
      if (Date.now() - waitStart > 60_000) {
        return {
          success: false,
          text: "",
          toolCalls: 0,
          durationMs: 0,
          error: "Timed out waiting for execution slot",
        };
      }
    }
  }

  // ---- 3. Mark as active ----
  activeExecutions.set(sourceId, { startedAt: Date.now(), sourceType });
  cooldowns.set(sourceId, Date.now());

  // ---- 4. Build message with context ----
  let fullMessage = message;
  if (context && Object.keys(context).length > 0) {
    fullMessage += `\n\n[Context: ${JSON.stringify(context)}]`;
  }

  // Session ID: isolated per source
  const sessionId = request.sessionId || `${sourceType}-${sourceId}`;

  logger.info("executor", `Executing [${sourceType}] ${sourceName}: ${message.slice(0, 80)}...`);
  await eventBus.emit("trigger:fired", { sourceId, sourceName, sourceType });

  // ---- 5. Process through ChatProcessor ----
  const startTime = Date.now();
  let result: ExecutionResult;

  try {
    const chatResult: ChatResult = await processChatSync({
      message: fullMessage,
      sessionId,
      channel: sourceType === "webhook" ? "api" : sourceType as any,
    });

    result = {
      success: true,
      text: chatResult.text,
      toolCalls: chatResult.toolCalls.length,
      durationMs: chatResult.durationMs,
    };

    logger.info(
      "executor",
      `Completed [${sourceType}] ${sourceName}: ${result.toolCalls} tools, ${result.durationMs}ms`
    );
  } catch (err: any) {
    result = {
      success: false,
      text: "",
      toolCalls: 0,
      durationMs: Date.now() - startTime,
      error: err.message || "Execution failed",
    };

    logger.error("executor", `Failed [${sourceType}] ${sourceName}: ${result.error}`);
  }

  // ---- 6. Cleanup ----
  activeExecutions.delete(sourceId);

  // ---- 7. Record history ----
  executionHistory.push({
    sourceId,
    sourceName,
    sourceType,
    success: result.success,
    durationMs: result.durationMs,
    timestamp: Date.now(),
    error: result.error,
  });
  if (executionHistory.length > MAX_HISTORY) {
    executionHistory.splice(0, executionHistory.length - MAX_HISTORY);
  }

  return result;
}

// ============================================
// CONVENIENCE METHODS
// ============================================

/**
 * Execute a trigger action.
 */
export async function executeTrigger(
  triggerId: string,
  triggerName: string,
  action: string,
  data: Record<string, any>
): Promise<ExecutionResult> {
  return execute({
    sourceId: triggerId,
    sourceName: triggerName,
    sourceType: "trigger",
    message: `[TRIGGER: ${triggerName}] ${action}`,
    context: data,
  });
}

/**
 * Execute a scheduled task.
 */
export async function executeScheduledTask(
  taskId: string,
  taskName: string,
  taskInstruction: string
): Promise<ExecutionResult> {
  return execute({
    sourceId: taskId,
    sourceName: taskName,
    sourceType: "scheduler",
    message: `[Scheduled Task: ${taskName}] ${taskInstruction}`,
    sessionId: `scheduler-${taskId}`,
  });
}

/**
 * Execute a webhook action.
 */
export async function executeWebhook(
  triggerId: string,
  triggerName: string,
  action: string,
  payload: any
): Promise<ExecutionResult> {
  return execute({
    sourceId: triggerId,
    sourceName: triggerName,
    sourceType: "webhook",
    message: `[WEBHOOK: ${triggerName}] ${action}`,
    context: { payload },
  });
}

/**
 * Execute a heartbeat task.
 */
export async function executeHeartbeat(
  taskId: string,
  taskName: string,
  prompt: string
): Promise<ExecutionResult> {
  return execute({
    sourceId: taskId,
    sourceName: taskName,
    sourceType: "heartbeat",
    message: prompt,
    sessionId: "heartbeat",
  });
}

// ============================================
// STATUS & STATS
// ============================================

/**
 * Get currently active executions.
 */
export function getActiveExecutions(): Array<{
  sourceId: string;
  sourceType: string;
  startedAt: number;
  runningMs: number;
}> {
  const now = Date.now();
  return Array.from(activeExecutions.entries()).map(([id, info]) => ({
    sourceId: id,
    sourceType: info.sourceType,
    startedAt: info.startedAt,
    runningMs: now - info.startedAt,
  }));
}

/**
 * Get execution history.
 */
export function getExecutionHistory(limit: number = 20): typeof executionHistory {
  return executionHistory.slice(-limit);
}

/**
 * Get executor stats.
 */
export function getExecutorStats(): {
  activeCount: number;
  maxConcurrent: number;
  historyCount: number;
  successRate: number;
  recentExecutions: number;
} {
  const recent = executionHistory.filter((e) => Date.now() - e.timestamp < 3600_000);
  const successCount = executionHistory.filter((e) => e.success).length;

  return {
    activeCount: activeExecutions.size,
    maxConcurrent: MAX_CONCURRENT,
    historyCount: executionHistory.length,
    successRate: executionHistory.length > 0 ? Math.round((successCount / executionHistory.length) * 100) : 0,
    recentExecutions: recent.length,
  };
}
