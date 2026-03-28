/**
 * Karya Triggers — Event-based automation
 * 
 * NOW CONNECTED to ChatProcessor via TriggerExecutor (Phase 5.1):
 * - File Watcher: fs.watch() on directories → agent processes new/changed files
 * - Clipboard Watcher: poll every 5s → agent processes URLs/text
 * - Webhook: external HTTP POST → agent processes payload
 * 
 * Before: fireTrigger() → fetch("/api/chat") — broken, localhost-dependent
 * After: fireTrigger() → executeTrigger() → processChatSync() — direct, reliable
 */

import * as fs from "fs";
import * as path from "path";
import { eventBus } from "./event-bus";
import { logger } from "./logger";
import { executeTrigger, executeWebhook } from "./trigger-executor";

// ============================================
// TYPES
// ============================================

export type TriggerType = "file" | "clipboard" | "webhook";

export interface Trigger {
  id: string;
  type: TriggerType;
  name: string;
  enabled: boolean;
  config: TriggerConfig;
  /** The instruction for the agent when this trigger fires */
  action: string;
  createdAt: number;
  lastTriggered: number | null;
  triggerCount: number;
  lastError: string | null;
}

export interface TriggerConfig {
  // ---- File trigger ----
  /** Directory to watch */
  path?: string;
  /** File events to watch: "create", "change", "delete", "all" */
  events?: string[];
  /** File pattern regex (e.g., "\\.pdf$" for PDFs only) */
  pattern?: string;
  /** Ignore patterns (e.g., node_modules, .git) */
  ignore?: string[];

  // ---- Clipboard trigger ----
  /** Content type filter: "url", "text", "any" */
  contentType?: "url" | "text" | "any";

  // ---- Webhook trigger ----
  /** Secret token for webhook validation (optional) */
  secret?: string;
  /** Expected content type */
  expectedContentType?: string;

  // ---- Common ----
  /** Cooldown in milliseconds between fires (default: 5000) */
  cooldownMs?: number;
  /** Max fires per hour (0 = unlimited) */
  maxPerHour?: number;
}

// ============================================
// STATE
// ============================================

/** All registered triggers */
const triggers = new Map<string, Trigger>();

/** Active fs.watch() handles */
const fileWatchers = new Map<string, fs.FSWatcher>();

/** Clipboard polling interval */
let clipboardInterval: NodeJS.Timeout | null = null;
let lastClipboardContent = "";

/** Fire count tracking for rate limiting */
const fireCountPerHour = new Map<string, { count: number; resetAt: number }>();

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Create a new trigger and start it immediately if enabled.
 */
export function createTrigger(
  type: TriggerType,
  name: string,
  config: TriggerConfig,
  action: string
): Trigger {
  const id = `trigger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const trigger: Trigger = {
    id,
    type,
    name,
    enabled: true,
    config,
    action,
    createdAt: Date.now(),
    lastTriggered: null,
    triggerCount: 0,
    lastError: null,
  };

  triggers.set(id, trigger);
  startTrigger(trigger);

  eventBus.emit("trigger:created", { id, type, name });
  logger.info("triggers", `Created: [${type}] ${name} (${id})`);

  return trigger;
}

/**
 * List all triggers.
 */
export function listTriggers(): Trigger[] {
  return Array.from(triggers.values());
}

/**
 * Get a trigger by ID.
 */
export function getTrigger(id: string): Trigger | undefined {
  return triggers.get(id);
}

/**
 * Toggle a trigger on/off.
 */
export function toggleTrigger(id: string, enabled?: boolean): boolean {
  const trigger = triggers.get(id);
  if (!trigger) return false;

  trigger.enabled = enabled !== undefined ? enabled : !trigger.enabled;

  if (trigger.enabled) {
    startTrigger(trigger);
  } else {
    stopTrigger(trigger);
  }

  logger.info("triggers", `${trigger.enabled ? "Enabled" : "Disabled"}: ${trigger.name}`);
  return true;
}

/**
 * Delete a trigger and stop its watcher.
 */
export function deleteTrigger(id: string): boolean {
  const trigger = triggers.get(id);
  if (!trigger) return false;

  stopTrigger(trigger);
  triggers.delete(id);

  eventBus.emit("trigger:deleted", { id });
  logger.info("triggers", `Deleted: ${trigger.name}`);
  return true;
}

/**
 * Get trigger stats.
 */
export function getTriggerStats(): {
  total: number;
  active: number;
  byType: Record<string, number>;
  totalFires: number;
} {
  const all = Array.from(triggers.values());
  return {
    total: all.length,
    active: all.filter((t) => t.enabled).length,
    byType: {
      file: all.filter((t) => t.type === "file").length,
      clipboard: all.filter((t) => t.type === "clipboard").length,
      webhook: all.filter((t) => t.type === "webhook").length,
    },
    totalFires: all.reduce((sum, t) => sum + t.triggerCount, 0),
  };
}

// ============================================
// START / STOP TRIGGERS
// ============================================

function startTrigger(trigger: Trigger): void {
  switch (trigger.type) {
    case "file":
      startFileWatcher(trigger);
      break;
    case "clipboard":
      startClipboardWatcher();
      break;
    case "webhook":
      // Webhooks are passive — they wait for HTTP requests
      logger.info("triggers", `Webhook ready: /api/v1/webhook/${trigger.id}`);
      break;
  }
}

function stopTrigger(trigger: Trigger): void {
  switch (trigger.type) {
    case "file": {
      const watcher = fileWatchers.get(trigger.id);
      if (watcher) {
        watcher.close();
        fileWatchers.delete(trigger.id);
        logger.info("triggers", `File watcher stopped: ${trigger.config.path}`);
      }
      break;
    }
    case "clipboard": {
      // Only stop if no more clipboard triggers
      const hasOther = Array.from(triggers.values()).some(
        (t) => t.type === "clipboard" && t.enabled && t.id !== trigger.id
      );
      if (!hasOther && clipboardInterval) {
        clearInterval(clipboardInterval);
        clipboardInterval = null;
        logger.info("triggers", "Clipboard watcher stopped");
      }
      break;
    }
  }
}

// ============================================
// FILE WATCHER
// ============================================

function startFileWatcher(trigger: Trigger): void {
  const watchPath = trigger.config.path;
  if (!watchPath) {
    trigger.lastError = "No path configured";
    logger.warn("triggers", `File trigger ${trigger.name}: no path configured`);
    return;
  }

  if (!fs.existsSync(watchPath)) {
    trigger.lastError = `Path not found: ${watchPath}`;
    logger.warn("triggers", `File trigger ${trigger.name}: path not found: ${watchPath}`);
    return;
  }

  // Close existing watcher if any
  const existing = fileWatchers.get(trigger.id);
  if (existing) existing.close();

  const allowedEvents = trigger.config.events || ["create", "change"];
  const ignorePatterns = trigger.config.ignore || [
    "node_modules", ".git", ".next", "__pycache__", ".DS_Store", "Thumbs.db",
  ];

  try {
    const watcher = fs.watch(
      watchPath,
      { recursive: true },
      (eventType, filename) => {
        if (!trigger.enabled || !filename) return;

        // Ignore filtered paths
        const shouldIgnore = ignorePatterns.some((p) =>
          filename.includes(p)
        );
        if (shouldIgnore) return;

        // Map fs event types
        const eventMap: Record<string, string> = {
          rename: "create", // Could be create or delete — fs.watch limitation
          change: "change",
        };
        const mappedEvent = eventMap[eventType] || eventType;

        if (!allowedEvents.includes(mappedEvent) && !allowedEvents.includes("all")) {
          return;
        }

        // Pattern filter
        if (trigger.config.pattern) {
          try {
            const regex = new RegExp(trigger.config.pattern, "i");
            if (!regex.test(filename)) return;
          } catch {
            // Invalid regex — skip filter
          }
        }

        // Rate limit check
        if (!checkRateLimit(trigger)) return;

        // FIRE!
        const fullPath = path.join(watchPath, filename);
        const fileExists = fs.existsSync(fullPath);

        fireTrigger(trigger, {
          event: fileExists ? mappedEvent : "delete",
          filename,
          fullPath,
          directory: watchPath,
          exists: fileExists,
          size: fileExists ? safeStatSize(fullPath) : 0,
        });
      }
    );

    fileWatchers.set(trigger.id, watcher);
    trigger.lastError = null;
    logger.info("triggers", `File watcher started: ${watchPath} (${allowedEvents.join(", ")})`);

    watcher.on("error", (err) => {
      trigger.lastError = err.message;
      logger.error("triggers", `File watcher error (${trigger.name}): ${err.message}`);
    });
  } catch (err: any) {
    trigger.lastError = err.message;
    logger.error("triggers", `Failed to start file watcher: ${err.message}`);
  }
}

function safeStatSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

// ============================================
// CLIPBOARD WATCHER
// ============================================

function startClipboardWatcher(): void {
  if (clipboardInterval) return; // Already running

  const POLL_INTERVAL = 5000; // 5 seconds

  const checkClipboard = async () => {
    try {
      const { execSync } = await import("child_process");
      const content = execSync("powershell -command Get-Clipboard", {
        encoding: "utf-8",
        timeout: 3000,
        windowsHide: true,
      }).trim();

      if (!content || content === lastClipboardContent) return;

      const previousContent = lastClipboardContent;
      lastClipboardContent = content;

      // Skip first read (don't trigger on startup clipboard content)
      if (!previousContent) return;

      // Determine content type
      const isUrl = /^https?:\/\//i.test(content);
      const contentType = isUrl ? "url" : "text";

      // Fire matching clipboard triggers
      for (const trigger of triggers.values()) {
        if (trigger.type !== "clipboard" || !trigger.enabled) continue;

        // Content type filter
        const wantType = trigger.config.contentType || "any";
        if (wantType !== "any" && wantType !== contentType) continue;

        // Pattern filter
        if (trigger.config.pattern) {
          try {
            const regex = new RegExp(trigger.config.pattern, "i");
            if (!regex.test(content)) continue;
          } catch {
            // Invalid regex — skip
          }
        }

        // Rate limit
        if (!checkRateLimit(trigger)) continue;

        fireTrigger(trigger, {
          content,
          previousContent,
          contentType,
          length: content.length,
        });
      }
    } catch {
      // Clipboard read failure — silent (common when clipboard is locked)
    }
  };

  clipboardInterval = setInterval(checkClipboard, POLL_INTERVAL);
  // Don't prevent Node.js exit
  if (clipboardInterval.unref) {
    clipboardInterval.unref();
  }

  logger.info("triggers", `Clipboard watcher started (every ${POLL_INTERVAL / 1000}s)`);
}

// ============================================
// WEBHOOK HANDLER
// ============================================

/**
 * Handle an incoming webhook request.
 * Called from /api/v1/webhook/:id route.
 */
export async function handleWebhook(
  triggerId: string,
  payload: any,
  headers?: Record<string, string>
): Promise<{ fired: boolean; error?: string }> {
  const trigger = triggers.get(triggerId);

  if (!trigger) {
    return { fired: false, error: "Trigger not found" };
  }

  if (trigger.type !== "webhook") {
    return { fired: false, error: "Not a webhook trigger" };
  }

  if (!trigger.enabled) {
    return { fired: false, error: "Trigger is disabled" };
  }

  // Secret validation
  if (trigger.config.secret) {
    const providedSecret = headers?.["x-webhook-secret"] || headers?.["authorization"];
    if (providedSecret !== trigger.config.secret && providedSecret !== `Bearer ${trigger.config.secret}`) {
      logger.warn("triggers", `Webhook ${trigger.name}: invalid secret`);
      return { fired: false, error: "Invalid secret" };
    }
  }

  // Rate limit
  if (!checkRateLimit(trigger)) {
    return { fired: false, error: "Rate limited" };
  }

  // Fire via executor
  const result = await executeWebhook(
    trigger.id,
    trigger.name,
    trigger.action,
    payload
  );

  // Update trigger stats
  trigger.lastTriggered = Date.now();
  trigger.triggerCount++;
  if (!result.success) {
    trigger.lastError = result.error || null;
  } else {
    trigger.lastError = null;
  }

  return { fired: true };
}

// ============================================
// FIRE TRIGGER (CORE)
// ============================================

/**
 * Fire a trigger — sends to TriggerExecutor which calls ChatProcessor.
 */
async function fireTrigger(trigger: Trigger, data: Record<string, any>): Promise<void> {
  trigger.lastTriggered = Date.now();
  trigger.triggerCount++;

  logger.info("triggers", `Fired: [${trigger.type}] ${trigger.name}`);

  try {
    const result = await executeTrigger(
      trigger.id,
      trigger.name,
      trigger.action,
      data
    );

    if (!result.success) {
      trigger.lastError = result.error || "Execution failed";
    } else {
      trigger.lastError = null;
    }
  } catch (err: any) {
    trigger.lastError = err.message;
    logger.error("triggers", `Fire error (${trigger.name}): ${err.message}`);
  }
}

// ============================================
// RATE LIMITING
// ============================================

function checkRateLimit(trigger: Trigger): boolean {
  const maxPerHour = trigger.config.maxPerHour || 0;
  if (maxPerHour <= 0) return true; // Unlimited

  const now = Date.now();
  let tracker = fireCountPerHour.get(trigger.id);

  if (!tracker || now > tracker.resetAt) {
    tracker = { count: 0, resetAt: now + 3600_000 };
    fireCountPerHour.set(trigger.id, tracker);
  }

  if (tracker.count >= maxPerHour) {
    logger.debug("triggers", `Rate limited: ${trigger.name} (${tracker.count}/${maxPerHour} per hour)`);
    return false;
  }

  tracker.count++;
  return true;
}

// ============================================
// CLEANUP
// ============================================

/**
 * Stop all triggers and clean up watchers.
 */
export function stopAllTriggers(): void {
  for (const watcher of fileWatchers.values()) {
    watcher.close();
  }
  fileWatchers.clear();

  if (clipboardInterval) {
    clearInterval(clipboardInterval);
    clipboardInterval = null;
  }

  logger.info("triggers", "All triggers stopped");
}
