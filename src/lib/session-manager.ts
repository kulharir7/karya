import { LibSQLStore } from "@mastra/libsql";
import { createClient, type Client } from "@libsql/client";
import * as path from "path";

/**
 * Server-side Session Manager — persistent sessions via LibSQL (SQLite).
 * 
 * Replaces localStorage sessions completely.
 * All session data lives on the server, survives restarts.
 * 
 * Tables:
 *   sessions — session metadata (id, name, created, updated, status, token count)
 *   messages — all messages per session (role, content, tool calls, timestamps)
 */

export interface SessionMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  tokenEstimate: number;
  status: "active" | "archived" | "deleted";
}

export interface StoredMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: { toolName: string; args?: any; result?: any; status: string }[];
  timestamp: number;
}

// Singleton database client
let db: Client | null = null;
let initialized = false;

function getDB(): Client {
  if (!db) {
    const dbPath = path.join(process.cwd(), "karya-sessions.db");
    db = createClient({
      url: `file:${dbPath}`,
    });
  }
  return db;
}

/**
 * Initialize database tables. Safe to call multiple times (IF NOT EXISTS).
 */
export async function initSessionDB(): Promise<void> {
  if (initialized) return;
  const client = getDB();

  await client.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'New Chat',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      messageCount INTEGER NOT NULL DEFAULT 0,
      tokenEstimate INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active'
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      toolCalls TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Index for fast message lookup by session
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_session 
    ON messages(sessionId, timestamp ASC)
  `);

  initialized = true;
}

// ============================================
// SESSION OPERATIONS
// ============================================

/**
 * List all active sessions, ordered by most recently updated.
 */
export async function listSessions(): Promise<SessionMeta[]> {
  await initSessionDB();
  const result = await getDB().execute(`
    SELECT id, name, createdAt, updatedAt, messageCount, tokenEstimate, status
    FROM sessions 
    WHERE status = 'active'
    ORDER BY updatedAt DESC
  `);

  return result.rows.map((row: any) => ({
    id: row.id as string,
    name: row.name as string,
    createdAt: row.createdAt as number,
    updatedAt: row.updatedAt as number,
    messageCount: row.messageCount as number,
    tokenEstimate: row.tokenEstimate as number,
    status: row.status as "active",
  }));
}

/**
 * Get a single session by ID.
 */
export async function getSession(id: string): Promise<SessionMeta | null> {
  await initSessionDB();
  const result = await getDB().execute({
    sql: `SELECT id, name, createdAt, updatedAt, messageCount, tokenEstimate, status 
          FROM sessions WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) return null;
  const row = result.rows[0] as any;
  return {
    id: row.id, name: row.name, createdAt: row.createdAt,
    updatedAt: row.updatedAt, messageCount: row.messageCount,
    tokenEstimate: row.tokenEstimate, status: row.status,
  };
}

/**
 * Create a new session. Returns the session metadata.
 */
export async function createSession(name?: string): Promise<SessionMeta> {
  await initSessionDB();
  const now = Date.now();
  const id = `session-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionName = name || "New Chat";

  await getDB().execute({
    sql: `INSERT INTO sessions (id, name, createdAt, updatedAt, messageCount, tokenEstimate, status)
          VALUES (?, ?, ?, ?, 0, 0, 'active')`,
    args: [id, sessionName, now, now],
  });

  return {
    id, name: sessionName, createdAt: now, updatedAt: now,
    messageCount: 0, tokenEstimate: 0, status: "active",
  };
}

/**
 * Rename a session.
 */
export async function renameSession(id: string, name: string): Promise<void> {
  await initSessionDB();
  await getDB().execute({
    sql: `UPDATE sessions SET name = ?, updatedAt = ? WHERE id = ?`,
    args: [name.slice(0, 100), Date.now(), id],
  });
}

/**
 * Delete a session (soft delete — marks as deleted).
 */
export async function deleteSession(id: string): Promise<void> {
  await initSessionDB();
  await getDB().execute({
    sql: `UPDATE sessions SET status = 'deleted', updatedAt = ? WHERE id = ?`,
    args: [Date.now(), id],
  });
}

/**
 * Hard delete — actually removes session and all messages from DB.
 */
export async function purgeSession(id: string): Promise<void> {
  await initSessionDB();
  const client = getDB();
  await client.execute({ sql: `DELETE FROM messages WHERE sessionId = ?`, args: [id] });
  await client.execute({ sql: `DELETE FROM sessions WHERE id = ?`, args: [id] });
}

// ============================================
// MESSAGE OPERATIONS
// ============================================

/**
 * Get messages for a session, ordered by timestamp.
 * Supports limit and offset for pagination.
 */
export async function getMessages(
  sessionId: string,
  limit: number = 100,
  offset: number = 0
): Promise<StoredMessage[]> {
  await initSessionDB();
  const result = await getDB().execute({
    sql: `SELECT id, sessionId, role, content, toolCalls, timestamp
          FROM messages 
          WHERE sessionId = ?
          ORDER BY timestamp ASC
          LIMIT ? OFFSET ?`,
    args: [sessionId, limit, offset],
  });

  return result.rows.map((row: any) => ({
    id: row.id as string,
    sessionId: row.sessionId as string,
    role: row.role as "user" | "assistant" | "system",
    content: row.content as string,
    toolCalls: row.toolCalls ? JSON.parse(row.toolCalls as string) : undefined,
    timestamp: row.timestamp as number,
  }));
}

/**
 * Get the last N messages for a session (for context window).
 */
export async function getRecentMessages(
  sessionId: string,
  count: number = 20
): Promise<StoredMessage[]> {
  await initSessionDB();
  // Get last N messages by subquery
  const result = await getDB().execute({
    sql: `SELECT id, sessionId, role, content, toolCalls, timestamp
          FROM messages 
          WHERE sessionId = ?
          ORDER BY timestamp DESC
          LIMIT ?`,
    args: [sessionId, count],
  });

  // Reverse to get chronological order
  const messages = result.rows.map((row: any) => ({
    id: row.id as string,
    sessionId: row.sessionId as string,
    role: row.role as "user" | "assistant" | "system",
    content: row.content as string,
    toolCalls: row.toolCalls ? JSON.parse(row.toolCalls as string) : undefined,
    timestamp: row.timestamp as number,
  }));

  return messages.reverse();
}

/**
 * Add a message to a session.
 * Automatically updates session metadata (messageCount, updatedAt, tokenEstimate).
 */
export async function addMessage(
  sessionId: string,
  message: Omit<StoredMessage, "id" | "sessionId">
): Promise<StoredMessage> {
  await initSessionDB();
  const client = getDB();
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const toolCallsJson = message.toolCalls ? JSON.stringify(message.toolCalls) : null;

  // Rough token estimate: ~4 chars per token
  const tokenEstDelta = Math.ceil((message.content.length + (toolCallsJson?.length || 0)) / 4);

  await client.execute({
    sql: `INSERT INTO messages (id, sessionId, role, content, toolCalls, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, sessionId, message.role, message.content, toolCallsJson, message.timestamp],
  });

  await client.execute({
    sql: `UPDATE sessions 
          SET messageCount = messageCount + 1, 
              updatedAt = ?,
              tokenEstimate = tokenEstimate + ?
          WHERE id = ?`,
    args: [Date.now(), tokenEstDelta, sessionId],
  });

  return {
    id,
    sessionId,
    role: message.role,
    content: message.content,
    toolCalls: message.toolCalls,
    timestamp: message.timestamp,
  };
}

/**
 * Get total message count for a session.
 */
export async function getMessageCount(sessionId: string): Promise<number> {
  await initSessionDB();
  const result = await getDB().execute({
    sql: `SELECT COUNT(*) as count FROM messages WHERE sessionId = ?`,
    args: [sessionId],
  });
  return (result.rows[0] as any).count as number;
}

/**
 * Clear all messages in a session (reset chat).
 */
export async function clearMessages(sessionId: string): Promise<void> {
  await initSessionDB();
  const client = getDB();
  await client.execute({ sql: `DELETE FROM messages WHERE sessionId = ?`, args: [sessionId] });
  await client.execute({
    sql: `UPDATE sessions SET messageCount = 0, tokenEstimate = 0, updatedAt = ? WHERE id = ?`,
    args: [Date.now(), sessionId],
  });
}

/**
 * Ensure a default session exists. Returns its ID.
 */
export async function ensureDefaultSession(): Promise<string> {
  await initSessionDB();
  const existing = await getSession("default");
  if (existing) return "default";

  const now = Date.now();
  await getDB().execute({
    sql: `INSERT OR IGNORE INTO sessions (id, name, createdAt, updatedAt, messageCount, tokenEstimate, status)
          VALUES ('default', 'Main', ?, ?, 0, 0, 'active')`,
    args: [now, now],
  });
  return "default";
}
