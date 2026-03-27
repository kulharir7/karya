/**
 * Karya Audit Log — Track all actions
 * 
 * Records:
 * - Tool calls (who, what, when, result)
 * - Session events
 * - Trigger fires
 * - Errors
 * 
 * Storage: SQLite via LibSQL
 */

import { createClient } from "@libsql/client";
import * as path from "path";
import { eventBus } from "./event-bus";

// Database
const DB_PATH = path.join(process.cwd(), "data", "karya-audit.db");
const db = createClient({ url: `file:${DB_PATH}` });

// Audit entry types
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
  | "permission_denied"
  | "user_message"
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

// Initialize database
let initialized = false;

async function initDB(): Promise<void> {
  if (initialized) return;
  
  await db.execute(`
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
  
  // Index for fast queries
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log(sessionId)
  `);
  
  initialized = true;
  console.log("[audit] Audit log initialized");
}

/**
 * Log an audit entry
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
): Promise<number> {
  await initDB();
  
  const entry = {
    timestamp: Date.now(),
    action,
    sessionId: options.sessionId || null,
    tool: options.tool || null,
    input: options.input ? JSON.stringify(options.input).slice(0, 5000) : null,
    output: options.output ? JSON.stringify(options.output).slice(0, 5000) : null,
    success: options.success !== false ? 1 : 0,
    duration: options.duration || null,
    metadata: options.metadata ? JSON.stringify(options.metadata) : null,
  };
  
  const result = await db.execute({
    sql: `INSERT INTO audit_log 
          (timestamp, action, sessionId, tool, input, output, success, duration, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entry.timestamp,
      entry.action,
      entry.sessionId,
      entry.tool,
      entry.input,
      entry.output,
      entry.success,
      entry.duration,
      entry.metadata,
    ],
  });
  
  return Number(result.lastInsertRowid);
}

/**
 * Get audit entries
 */
export async function getAuditLog(options: {
  limit?: number;
  offset?: number;
  action?: AuditAction;
  sessionId?: string;
  startTime?: number;
  endTime?: number;
  tool?: string;
  success?: boolean;
} = {}): Promise<AuditEntry[]> {
  await initDB();
  
  let sql = "SELECT * FROM audit_log WHERE 1=1";
  const args: any[] = [];
  
  if (options.action) {
    sql += " AND action = ?";
    args.push(options.action);
  }
  
  if (options.sessionId) {
    sql += " AND sessionId = ?";
    args.push(options.sessionId);
  }
  
  if (options.tool) {
    sql += " AND tool = ?";
    args.push(options.tool);
  }
  
  if (options.startTime) {
    sql += " AND timestamp >= ?";
    args.push(options.startTime);
  }
  
  if (options.endTime) {
    sql += " AND timestamp <= ?";
    args.push(options.endTime);
  }
  
  if (options.success !== undefined) {
    sql += " AND success = ?";
    args.push(options.success ? 1 : 0);
  }
  
  sql += " ORDER BY timestamp DESC";
  sql += ` LIMIT ${options.limit || 100}`;
  
  if (options.offset) {
    sql += ` OFFSET ${options.offset}`;
  }
  
  const result = await db.execute({ sql, args });
  
  return result.rows.map((row: any) => ({
    id: row.id,
    timestamp: row.timestamp,
    action: row.action,
    sessionId: row.sessionId,
    tool: row.tool,
    input: row.input,
    output: row.output,
    success: row.success === 1,
    duration: row.duration,
    metadata: row.metadata,
  }));
}

/**
 * Get audit stats
 */
export async function getAuditStats(days: number = 7): Promise<{
  totalEntries: number;
  byAction: Record<string, number>;
  byTool: Record<string, number>;
  successRate: number;
  avgDuration: number;
}> {
  await initDB();
  
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
  
  // Total entries
  const totalResult = await db.execute({
    sql: "SELECT COUNT(*) as count FROM audit_log WHERE timestamp >= ?",
    args: [startTime],
  });
  const totalEntries = Number(totalResult.rows[0]?.count || 0);
  
  // By action
  const actionResult = await db.execute({
    sql: `SELECT action, COUNT(*) as count FROM audit_log 
          WHERE timestamp >= ? GROUP BY action`,
    args: [startTime],
  });
  const byAction: Record<string, number> = {};
  for (const row of actionResult.rows as any[]) {
    byAction[row.action] = Number(row.count);
  }
  
  // By tool (only tool_call actions)
  const toolResult = await db.execute({
    sql: `SELECT tool, COUNT(*) as count FROM audit_log 
          WHERE timestamp >= ? AND action = 'tool_call' AND tool IS NOT NULL
          GROUP BY tool ORDER BY count DESC LIMIT 20`,
    args: [startTime],
  });
  const byTool: Record<string, number> = {};
  for (const row of toolResult.rows as any[]) {
    byTool[row.tool] = Number(row.count);
  }
  
  // Success rate
  const successResult = await db.execute({
    sql: `SELECT 
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success,
            COUNT(*) as total
          FROM audit_log WHERE timestamp >= ?`,
    args: [startTime],
  });
  const successCount = Number((successResult.rows[0] as any)?.success || 0);
  const totalCount = Number((successResult.rows[0] as any)?.total || 1);
  const successRate = Math.round((successCount / totalCount) * 100);
  
  // Average duration
  const durationResult = await db.execute({
    sql: `SELECT AVG(duration) as avg FROM audit_log 
          WHERE timestamp >= ? AND duration IS NOT NULL`,
    args: [startTime],
  });
  const avgDuration = Math.round(Number((durationResult.rows[0] as any)?.avg || 0));
  
  return {
    totalEntries,
    byAction,
    byTool,
    successRate,
    avgDuration,
  };
}

/**
 * Clear old audit entries
 */
export async function clearOldAudit(daysToKeep: number = 30): Promise<number> {
  await initDB();
  
  const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
  
  const result = await db.execute({
    sql: "DELETE FROM audit_log WHERE timestamp < ?",
    args: [cutoff],
  });
  
  return Number(result.rowsAffected);
}

/**
 * Setup event bus hooks for automatic logging
 */
export function setupAuditHooks(): void {
  // Tool calls
  eventBus.on("tool:before_call", (data) => {
    // Store start time in metadata for duration calculation
    (data as any)._auditStart = Date.now();
  });
  
  eventBus.on("tool:after_call", (data) => {
    const startTime = (data as any)._auditStart || Date.now();
    const duration = Date.now() - startTime;
    
    logAudit("tool_call", {
      sessionId: data.sessionId,
      tool: data.tool,
      input: data.args,
      output: data.result,
      success: true,
      duration,
    });
  });
  
  eventBus.on("tool:error", (data) => {
    logAudit("tool_error", {
      sessionId: data.sessionId,
      tool: data.tool,
      input: data.args,
      output: data.error,
      success: false,
    });
  });
  
  // Agent lifecycle
  eventBus.on("agent:start", (data) => {
    logAudit("agent_start", { sessionId: data.sessionId });
  });
  
  eventBus.on("agent:end", (data) => {
    logAudit("agent_end", { sessionId: data.sessionId });
  });
  
  eventBus.on("agent:error", (data) => {
    logAudit("agent_error", {
      sessionId: data.sessionId,
      output: data.error,
      success: false,
    });
  });
  
  // Triggers
  eventBus.on("trigger:fired", (data) => {
    logAudit("trigger_fire", {
      metadata: data,
    });
  });
  
  // Sessions
  eventBus.on("session:created", (data) => {
    logAudit("session_create", { sessionId: data.sessionId });
  });
  
  eventBus.on("session:deleted", (data) => {
    logAudit("session_delete", { sessionId: data.sessionId });
  });
  
  console.log("[audit] Event hooks registered");
}

// Auto-initialize hooks
setupAuditHooks();
