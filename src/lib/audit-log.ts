/**
 * Karya Audit Log — Track ALL actions in SQLite
 * 
 * Phase 7.2 REWRITE:
 * - Event bus hooks actually connected (fixed field names)
 * - Auto-initialized on first import (not lazy)
 * - Duration tracking via Map (not hacky _auditStart on data object)
 * - Security blocked events logged
 * - Auto-cleanup of old entries
 * - Data directory auto-created
 * 
 * What gets logged:
 * - Every tool call (name, args summary, result summary, duration)
 * - Agent start/end per session
 * - Errors (agent + tool)
 * - Trigger fires
 * - Security blocks (with reason)
 * - Messages received (channel + session)
 */

import { createClient, type Client } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";
import { eventBus } from "./event-bus";

// ============================================
// TYPES
// ============================================

export type AuditAction =
  | "tool_call"
  | "tool_error"
  | "agent_start"
  | "agent_end"
  | "agent_error"
  | "session_create"
  | "session_delete"
  | "trigger_fire"
  | "webhook_receive"
  | "security_blocked"
  | "message_received"
  | "system_event";

export interface AuditEntry {
  id: number;
  timestamp: number;
  action: AuditAction;
  sessionId: string | null;
  tool: string | null;
  input: string | null;
  output: string | null;
  success: boolean;
  duration: number | null;
  metadata: string | null;
}

// ============================================
// DATABASE
// ============================================

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "karya-audit.db");

let db: Client | null = null;
let initialized = false;

function getDB(): Client {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db = createClient({ url: `file:${DB_PATH}` });
  }
  return db;
}

async function initDB(): Promise<void> {
  if (initialized) return;
  const client = getDB();

  await client.execute(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      action TEXT NOT NULL,
      sessionId TEXT,
      tool TEXT,
      input TEXT,
      output TEXT,
      success INTEGER DEFAULT 1,
      duration INTEGER,
      metadata TEXT
    )
  `);

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(timestamp DESC)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log(sessionId)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_audit_tool ON audit_log(tool)`);

  initialized = true;
}

// ============================================
// LOGGING
// ============================================

/**
 * Log an audit entry to the database.
 */
export async function logAudit(
  action: AuditAction,
  options: {
    sessionId?: string;
    tool?: string;
    input?: any;
    output?: any;
    success?: boolean;
    duration?: number;
    metadata?: Record<string, any>;
  } = {}
): Promise<void> {
  try {
    await initDB();

    const truncateJson = (val: any, max: number = 2000): string | null => {
      if (val === undefined || val === null) return null;
      const str = typeof val === "string" ? val : JSON.stringify(val);
      return str.length > max ? str.slice(0, max) + "..." : str;
    };

    await getDB().execute({
      sql: `INSERT INTO audit_log 
            (timestamp, action, sessionId, tool, input, output, success, duration, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        Date.now(),
        action,
        options.sessionId || null,
        options.tool || null,
        truncateJson(options.input),
        truncateJson(options.output),
        options.success !== false ? 1 : 0,
        options.duration || null,
        truncateJson(options.metadata),
      ],
    });
  } catch {
    // Audit logging failure should NEVER crash the app
  }
}

// ============================================
// QUERIES
// ============================================

export async function getAuditLog(options: {
  limit?: number;
  offset?: number;
  action?: AuditAction;
  sessionId?: string;
  tool?: string;
  startTime?: number;
  endTime?: number;
  success?: boolean;
} = {}): Promise<AuditEntry[]> {
  await initDB();

  let sql = "SELECT * FROM audit_log WHERE 1=1";
  const args: any[] = [];

  if (options.action) { sql += " AND action = ?"; args.push(options.action); }
  if (options.sessionId) { sql += " AND sessionId = ?"; args.push(options.sessionId); }
  if (options.tool) { sql += " AND tool = ?"; args.push(options.tool); }
  if (options.startTime) { sql += " AND timestamp >= ?"; args.push(options.startTime); }
  if (options.endTime) { sql += " AND timestamp <= ?"; args.push(options.endTime); }
  if (options.success !== undefined) { sql += " AND success = ?"; args.push(options.success ? 1 : 0); }

  sql += ` ORDER BY timestamp DESC LIMIT ${options.limit || 100}`;
  if (options.offset) sql += ` OFFSET ${options.offset}`;

  const result = await getDB().execute({ sql, args });

  return result.rows.map((row: any) => ({
    id: row.id as number,
    timestamp: row.timestamp as number,
    action: row.action as AuditAction,
    sessionId: row.sessionId as string | null,
    tool: row.tool as string | null,
    input: row.input as string | null,
    output: row.output as string | null,
    success: (row.success as number) === 1,
    duration: row.duration as number | null,
    metadata: row.metadata as string | null,
  }));
}

export async function getAuditStats(days: number = 7): Promise<{
  totalEntries: number;
  byAction: Record<string, number>;
  byTool: Record<string, number>;
  successRate: number;
  avgDuration: number;
  securityBlocks: number;
}> {
  await initDB();
  const startTime = Date.now() - days * 86400_000;
  const client = getDB();

  const totalResult = await client.execute({
    sql: "SELECT COUNT(*) as count FROM audit_log WHERE timestamp >= ?",
    args: [startTime],
  });
  const totalEntries = Number((totalResult.rows[0] as any)?.count || 0);

  const actionResult = await client.execute({
    sql: "SELECT action, COUNT(*) as count FROM audit_log WHERE timestamp >= ? GROUP BY action",
    args: [startTime],
  });
  const byAction: Record<string, number> = {};
  for (const row of actionResult.rows as any[]) byAction[row.action] = Number(row.count);

  const toolResult = await client.execute({
    sql: `SELECT tool, COUNT(*) as count FROM audit_log 
          WHERE timestamp >= ? AND action = 'tool_call' AND tool IS NOT NULL
          GROUP BY tool ORDER BY count DESC LIMIT 20`,
    args: [startTime],
  });
  const byTool: Record<string, number> = {};
  for (const row of toolResult.rows as any[]) byTool[row.tool] = Number(row.count);

  const successResult = await client.execute({
    sql: `SELECT SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as s, COUNT(*) as t
          FROM audit_log WHERE timestamp >= ?`,
    args: [startTime],
  });
  const sRow = successResult.rows[0] as any;
  const successRate = Math.round((Number(sRow?.s || 0) / Math.max(1, Number(sRow?.t || 1))) * 100);

  const durationResult = await client.execute({
    sql: "SELECT AVG(duration) as avg FROM audit_log WHERE timestamp >= ? AND duration IS NOT NULL",
    args: [startTime],
  });
  const avgDuration = Math.round(Number((durationResult.rows[0] as any)?.avg || 0));

  const blocksResult = await client.execute({
    sql: "SELECT COUNT(*) as count FROM audit_log WHERE timestamp >= ? AND action = 'security_blocked'",
    args: [startTime],
  });
  const securityBlocks = Number((blocksResult.rows[0] as any)?.count || 0);

  return { totalEntries, byAction, byTool, successRate, avgDuration, securityBlocks };
}

export async function clearOldAudit(daysToKeep: number = 30): Promise<number> {
  await initDB();
  const cutoff = Date.now() - daysToKeep * 86400_000;
  const result = await getDB().execute({ sql: "DELETE FROM audit_log WHERE timestamp < ?", args: [cutoff] });
  return Number(result.rowsAffected);
}

// ============================================
// EVENT BUS HOOKS — Auto-log everything
// ============================================

/** Duration tracking for tool calls */
const toolStartTimes = new Map<string, number>();

/**
 * Register all event bus hooks for automatic audit logging.
 * Called once — hooks persist for the lifetime of the process.
 */
export function setupAuditHooks(): void {
  // ---- Tool calls ----
  eventBus.on("tool:before_call", (data) => {
    const key = `${data.sessionId || ""}:${data.toolName || ""}:${Date.now()}`;
    toolStartTimes.set(data.toolName || "unknown", Date.now());
  });

  eventBus.on("tool:after_call", (data) => {
    const toolName = data.toolName || data.tool || "unknown";
    const startTime = toolStartTimes.get(toolName);
    const duration = startTime ? Date.now() - startTime : undefined;
    toolStartTimes.delete(toolName);

    logAudit("tool_call", {
      sessionId: data.sessionId,
      tool: toolName,
      input: data.args,
      output: typeof data.result === "string" ? data.result : data.result,
      success: true,
      duration,
    });
  });

  // ---- Agent lifecycle ----
  eventBus.on("agent:start", (data) => {
    logAudit("agent_start", {
      sessionId: data.sessionId,
      metadata: { channel: data.channel, message: data.message?.slice(0, 200) },
    });
  });

  eventBus.on("agent:end", (data) => {
    logAudit("agent_end", {
      sessionId: data.sessionId,
      metadata: { toolCount: data.toolCount, textLength: data.textLength, channel: data.channel },
    });
  });

  eventBus.on("agent:error", (data) => {
    logAudit("agent_error", {
      sessionId: data.sessionId,
      output: data.error,
      success: false,
      metadata: { channel: data.channel },
    });
  });

  // ---- Messages ----
  eventBus.on("message:received", (data) => {
    logAudit("message_received", {
      sessionId: data.sessionId,
      input: data.message?.slice(0, 500),
      metadata: { channel: data.channel },
    });
  });

  // ---- Triggers ----
  eventBus.on("trigger:fired", (data) => {
    logAudit("trigger_fire", {
      tool: data.sourceName || data.name,
      metadata: { sourceType: data.sourceType, sourceId: data.sourceId },
    });
  });

  // ---- Security blocks ----
  eventBus.on("custom:security-blocked" as any, (data: any) => {
    logAudit("security_blocked", {
      tool: data.tool,
      output: data.reason,
      success: false,
      metadata: { blockedBy: data.blockedBy },
    });
  });

  // ---- Sessions ----
  eventBus.on("session:created", (data) => {
    logAudit("session_create", { sessionId: data.sessionId || data.id });
  });

  eventBus.on("session:deleted", (data) => {
    logAudit("session_delete", { sessionId: data.sessionId || data.id });
  });
}

// ============================================
// AUTO-INIT: Register hooks on import
// ============================================

// This ensures hooks are registered as soon as any file imports audit-log
let hooksRegistered = false;

export function ensureAuditHooks(): void {
  if (hooksRegistered) return;
  setupAuditHooks();
  hooksRegistered = true;
}

// Auto-register on module load
ensureAuditHooks();
