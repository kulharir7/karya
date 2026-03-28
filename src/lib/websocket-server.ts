/**
 * Karya WebSocket Server — Real-time bidirectional communication
 * 
 * NOW CONNECTED to ChatProcessor (Phase 4.2):
 * - Client sends { type: "chat", message: "hello" }
 * - Server processes through ChatProcessor
 * - Streams text-delta, tool-call, tool-result back via WS
 * - Multiple clients can subscribe to same session
 * - Abort support: client sends { type: "abort" } to cancel running request
 * 
 * Connection flow:
 *   1. Client connects → gets welcome + clientId
 *   2. Client sends { type: "subscribe", sessionId: "xxx" } → subscribed
 *   3. Client sends { type: "chat", data: { message: "..." } } → agent processes
 *   4. Server streams events back to ALL clients on that session
 *   5. Server sends { type: "done" } when complete
 * 
 * Auth:
 *   - Connect with ?token=karya_xxx for authenticated access
 *   - Or no token if auth is not configured (first-time setup)
 */

import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";
import { eventBus } from "./event-bus";
import {
  processChat,
  type ChatRequest,
  type ChatEvents,
  type ChatResult,
} from "./chat-processor";
import { validateToken, hasAnyTokens } from "./api-auth";

// ============================================
// TYPES
// ============================================

export type WSMessageType =
  | "chat"           // Client → Server: send message
  | "abort"          // Client → Server: cancel running request
  | "subscribe"      // Client → Server: subscribe to session
  | "unsubscribe"    // Client → Server: unsubscribe from session
  | "ping"           // Client → Server: heartbeat
  | "pong"           // Server → Client: heartbeat response
  | "text-delta"     // Server → Client: streaming text chunk
  | "text"           // Server → Client: complete text (non-streaming)
  | "tool-call"      // Server → Client: tool execution started
  | "tool-result"    // Server → Client: tool execution finished
  | "done"           // Server → Client: request complete
  | "error"          // Server → Client: error occurred
  | "session"        // Server → Client: session events (connected, subscribed, agent_start, etc.)
  | "sessions-list"  // Client → Server: request session list
  | "tools-list"     // Client → Server: request tools list
  | "status";        // Client → Server: request system status

export interface WSMessage {
  type: WSMessageType;
  sessionId?: string;
  data?: any;
  timestamp?: number;
}

export interface WSClient {
  id: string;
  ws: WebSocket;
  sessionId: string | null;
  connectedAt: number;
  lastPing: number;
  authenticated: boolean;
  /** AbortController for the currently running chat request */
  activeAbort: AbortController | null;
  /** Is this client currently waiting for an agent response? */
  processing: boolean;
}

// ============================================
// WEBSOCKET SERVER
// ============================================

class KaryaWebSocketServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private eventBusUnsubscribers: (() => void)[] = [];
  private port: number;
  private started: boolean = false;

  constructor(port: number = 3002) {
    super();
    this.port = port;
  }

  // ---- SERVER LIFECYCLE ----

  start(): void {
    if (this.wss) {
      console.log("[ws] Server already running");
      return;
    }

    try {
      this.wss = new WebSocketServer({ port: this.port });
      this.started = true;
      console.log(`[ws] WebSocket server started on port ${this.port}`);
    } catch (err: any) {
      console.error(`[ws] Failed to start on port ${this.port}:`, err.message);
      return;
    }

    this.wss.on("connection", (ws, req) => {
      // ---- Auth check ----
      const url = new URL(req.url || "/", `http://localhost:${this.port}`);
      const token = url.searchParams.get("token");
      let authenticated = true;

      if (hasAnyTokens()) {
        if (!token) {
          authenticated = false;
        } else {
          const validation = validateToken(token);
          if (!validation.valid) {
            ws.close(4001, "Invalid token");
            return;
          }
        }
      }

      const clientId = this.generateClientId();
      const client: WSClient = {
        id: clientId,
        ws,
        sessionId: null,
        connectedAt: Date.now(),
        lastPing: Date.now(),
        authenticated,
        activeAbort: null,
        processing: false,
      };

      this.clients.set(clientId, client);
      console.log(`[ws] Client connected: ${clientId} (total: ${this.clients.size})`);

      // Welcome message
      this.send(ws, {
        type: "session",
        data: {
          event: "connected",
          clientId,
          authenticated,
          serverTime: new Date().toISOString(),
        },
      });

      // Message handler
      ws.on("message", (raw) => {
        try {
          const message = JSON.parse(raw.toString()) as WSMessage;
          this.handleMessage(client, message);
        } catch {
          this.send(ws, { type: "error", data: { message: "Invalid JSON" } });
        }
      });

      // Disconnect handler
      ws.on("close", () => {
        // Cancel any running request
        if (client.activeAbort) {
          client.activeAbort.abort();
          client.activeAbort = null;
        }
        this.clients.delete(clientId);
        console.log(`[ws] Client disconnected: ${clientId} (total: ${this.clients.size})`);
      });

      ws.on("error", (err) => {
        console.error(`[ws] Client error ${clientId}:`, err.message);
      });
    });

    this.startHeartbeat();
    this.setupEventBusHooks();
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Unsubscribe from event bus
    for (const unsub of this.eventBusUnsubscribers) {
      unsub();
    }
    this.eventBusUnsubscribers = [];

    if (this.wss) {
      this.clients.forEach((client) => {
        if (client.activeAbort) client.activeAbort.abort();
        client.ws.close(1000, "Server shutting down");
      });
      this.clients.clear();
      this.wss.close();
      this.wss = null;
      this.started = false;
      console.log("[ws] WebSocket server stopped");
    }
  }

  isRunning(): boolean {
    return this.started && this.wss !== null;
  }

  // ---- MESSAGE HANDLING ----

  private async handleMessage(client: WSClient, message: WSMessage): Promise<void> {
    const { type, sessionId, data } = message;

    switch (type) {
      case "ping":
        client.lastPing = Date.now();
        this.send(client.ws, { type: "pong", timestamp: Date.now() });
        break;

      case "subscribe":
        if (sessionId) {
          client.sessionId = sessionId;
          this.send(client.ws, {
            type: "session",
            sessionId,
            data: { event: "subscribed", sessionId },
          });
          console.log(`[ws] Client ${client.id} subscribed to session ${sessionId}`);
        } else {
          this.send(client.ws, { type: "error", data: { message: "sessionId required for subscribe" } });
        }
        break;

      case "unsubscribe":
        client.sessionId = null;
        this.send(client.ws, { type: "session", data: { event: "unsubscribed" } });
        break;

      case "chat":
        await this.handleChat(client, sessionId || client.sessionId || "default", data);
        break;

      case "abort":
        this.handleAbort(client);
        break;

      case "sessions-list":
        await this.handleSessionsList(client);
        break;

      case "tools-list":
        await this.handleToolsList(client);
        break;

      case "status":
        await this.handleStatus(client);
        break;

      default:
        this.send(client.ws, {
          type: "error",
          data: { message: `Unknown message type: ${type}` },
        });
    }
  }

  // ---- CHAT PROCESSING (THE BIG ONE) ----

  private async handleChat(
    client: WSClient,
    sessionId: string,
    data: any
  ): Promise<void> {
    const messageText = typeof data === "string" ? data : data?.message;

    if (!messageText || typeof messageText !== "string") {
      this.send(client.ws, {
        type: "error",
        data: { message: "data.message is required" },
      });
      return;
    }

    // Prevent concurrent requests from same client
    if (client.processing) {
      this.send(client.ws, {
        type: "error",
        data: { message: "Already processing a request. Send 'abort' to cancel." },
      });
      return;
    }

    client.processing = true;
    client.activeAbort = new AbortController();

    // Auto-subscribe to session if not already
    if (client.sessionId !== sessionId) {
      client.sessionId = sessionId;
    }

    const chatReq: ChatRequest = {
      message: messageText,
      sessionId,
      images: data?.images,
      channel: "ws",
    };

    const events: ChatEvents = {
      onSession: (sid) => {
        // Broadcast to ALL clients on this session (not just the sender)
        this.broadcast(sid, {
          type: "session",
          data: { event: "agent_start", sessionId: sid },
        });
      },

      onTextDelta: (delta) => {
        this.broadcast(sessionId, {
          type: "text-delta",
          data: { delta, sessionId },
        });
      },

      onToolCall: (toolName, args) => {
        this.broadcast(sessionId, {
          type: "tool-call",
          data: { toolName, args, sessionId },
        });
      },

      onToolResult: (toolName, result) => {
        this.broadcast(sessionId, {
          type: "tool-result",
          data: { toolName, result, sessionId },
        });
      },

      onDone: (result: ChatResult) => {
        this.broadcast(sessionId, {
          type: "done",
          data: {
            sessionId: result.sessionId,
            text: result.text,
            toolCount: result.toolCalls.length,
            durationMs: result.durationMs,
            tokenEstimate: result.tokenEstimate,
          },
        });
      },

      onError: (error) => {
        this.broadcast(sessionId, {
          type: "error",
          data: { message: error, sessionId },
        });
        // Still send done so client knows request is finished
        this.broadcast(sessionId, {
          type: "done",
          data: { sessionId, error: true },
        });
      },
    };

    try {
      await processChat(chatReq, events);
    } catch (err: any) {
      console.error(`[ws] Chat processing error:`, err.message);
      this.send(client.ws, {
        type: "error",
        data: { message: err.message },
      });
    } finally {
      client.processing = false;
      client.activeAbort = null;
    }
  }

  // ---- ABORT ----

  private handleAbort(client: WSClient): void {
    if (client.activeAbort) {
      client.activeAbort.abort();
      client.activeAbort = null;
      client.processing = false;

      this.send(client.ws, {
        type: "session",
        data: { event: "aborted" },
      });
      console.log(`[ws] Client ${client.id} aborted request`);
    } else {
      this.send(client.ws, {
        type: "session",
        data: { event: "nothing_to_abort" },
      });
    }
  }

  // ---- DATA QUERIES VIA WS ----

  private async handleSessionsList(client: WSClient): Promise<void> {
    try {
      const { listSessions } = await import("./session-manager");
      const sessions = await listSessions();
      this.send(client.ws, {
        type: "session",
        data: {
          event: "sessions_list",
          sessions: sessions.map((s) => ({
            id: s.id,
            name: s.name,
            messageCount: s.messageCount,
            updatedAt: s.updatedAt,
          })),
        },
      });
    } catch (err: any) {
      this.send(client.ws, { type: "error", data: { message: err.message } });
    }
  }

  private async handleToolsList(client: WSClient): Promise<void> {
    try {
      const { getAllToolNames, getToolsByCategory } = await import("./chat-processor");
      this.send(client.ws, {
        type: "session",
        data: {
          event: "tools_list",
          tools: getAllToolNames(),
          categories: getToolsByCategory(),
        },
      });
    } catch (err: any) {
      this.send(client.ws, { type: "error", data: { message: err.message } });
    }
  }

  private async handleStatus(client: WSClient): Promise<void> {
    try {
      const { listSessions } = await import("./session-manager");
      const { getAllToolNames } = await import("./chat-processor");
      const sessions = await listSessions();
      const tools = getAllToolNames();

      this.send(client.ws, {
        type: "session",
        data: {
          event: "status",
          server: {
            uptime: Math.floor(process.uptime()),
            nodeVersion: process.version,
            wsClients: this.clients.size,
          },
          sessions: sessions.length,
          tools: tools.length,
          agents: 6,
        },
      });
    } catch (err: any) {
      this.send(client.ws, { type: "error", data: { message: err.message } });
    }
  }

  // ---- SEND / BROADCAST ----

  private send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...message, timestamp: Date.now() }));
    }
  }

  broadcast(sessionId: string, message: Omit<WSMessage, "sessionId">): void {
    const fullMessage: WSMessage = { ...message, sessionId, timestamp: Date.now() };
    const json = JSON.stringify(fullMessage);

    this.clients.forEach((client) => {
      if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(json);
      }
    });
  }

  broadcastAll(message: WSMessage): void {
    const json = JSON.stringify({ ...message, timestamp: Date.now() });
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(json);
      }
    });
  }

  sendToClient(clientId: string, message: WSMessage): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.send(client.ws, message);
    }
  }

  // ---- GETTERS ----

  getClientCount(): number {
    return this.clients.size;
  }

  getSessionClients(sessionId: string): string[] {
    const ids: string[] = [];
    this.clients.forEach((client) => {
      if (client.sessionId === sessionId) ids.push(client.id);
    });
    return ids;
  }

  getClients(): Array<{
    id: string;
    sessionId: string | null;
    connectedAt: number;
    processing: boolean;
    authenticated: boolean;
  }> {
    return Array.from(this.clients.values()).map((c) => ({
      id: c.id,
      sessionId: c.sessionId,
      connectedAt: c.connectedAt,
      processing: c.processing,
      authenticated: c.authenticated,
    }));
  }

  // ---- HEARTBEAT ----

  private startHeartbeat(): void {
    const HEARTBEAT_INTERVAL = 30_000;
    const HEARTBEAT_TIMEOUT = 90_000; // 90 seconds (more generous)

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      this.clients.forEach((client, id) => {
        if (now - client.lastPing > HEARTBEAT_TIMEOUT) {
          console.log(`[ws] Client ${id} timed out, disconnecting`);
          if (client.activeAbort) client.activeAbort.abort();
          client.ws.terminate();
          this.clients.delete(id);
        }
      });
    }, HEARTBEAT_INTERVAL);

    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  // ---- EVENT BUS HOOKS ----
  // These broadcast events from OTHER sources (SSE, bridges) to WS clients
  // so WS clients see real-time updates even if the request came from web UI

  private setupEventBusHooks(): void {
    const hooks: Array<[string, (data: any) => void]> = [
      ["agent:start", (data) => {
        if (data.sessionId) {
          this.broadcast(data.sessionId, {
            type: "session",
            data: { event: "agent_start", channel: data.channel },
          });
        }
      }],
      ["agent:end", (data) => {
        if (data.sessionId) {
          this.broadcast(data.sessionId, {
            type: "session",
            data: { event: "agent_end", toolCount: data.toolCount, textLength: data.textLength },
          });
        }
      }],
      ["agent:error", (data) => {
        if (data.sessionId) {
          this.broadcast(data.sessionId, {
            type: "error",
            data: { event: "agent_error", error: data.error },
          });
        }
      }],
      ["session:created", (data) => {
        this.broadcastAll({
          type: "session",
          data: { event: "session_created", ...data },
        });
      }],
      ["session:deleted", (data) => {
        this.broadcastAll({
          type: "session",
          data: { event: "session_deleted", ...data },
        });
      }],
      // Workflow events → broadcast to all
      ["workflow:start", (data) => {
        this.broadcastAll({
          type: "session",
          data: { event: "workflow_start", runId: data.runId, workflowId: data.workflowId },
        });
      }],
      ["workflow:complete", (data) => {
        this.broadcastAll({
          type: "session",
          data: { event: "workflow_complete", runId: data.runId, status: data.status },
        });
      }],
      ["workflow:error", (data) => {
        this.broadcastAll({
          type: "session",
          data: { event: "workflow_error", runId: data.runId, error: data.error },
        });
      }],
      // Sub-agent events
      ["subagent:spawned", (data) => {
        this.broadcastAll({
          type: "session",
          data: { event: "subagent_spawned", ...data },
        });
      }],
      ["subagent:completed", (data) => {
        this.broadcastAll({
          type: "session",
          data: { event: "subagent_completed", ...data },
        });
      }],
    ];

    for (const [event, handler] of hooks) {
      const unsub = eventBus.on(event as any, handler);
      this.eventBusUnsubscribers.push(unsub);
    }
  }

  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

// ============================================
// SINGLETON + EXPORTS
// ============================================

export const wsServer = new KaryaWebSocketServer(
  parseInt(process.env.KARYA_WS_PORT || "3002")
);

/** Start the WebSocket server */
export function startWebSocketServer(): void {
  wsServer.start();
}

/** Stop the WebSocket server */
export function stopWebSocketServer(): void {
  wsServer.stop();
}

/** Broadcast to all clients on a session */
export function broadcastToSession(sessionId: string, type: WSMessageType, data: any): void {
  wsServer.broadcast(sessionId, { type, data });
}

/** Stream text delta to session */
export function broadcastTextDelta(sessionId: string, delta: string): void {
  wsServer.broadcast(sessionId, { type: "text-delta", data: { delta } });
}

/** Broadcast tool call to session */
export function broadcastToolCall(sessionId: string, toolName: string, args: any): void {
  wsServer.broadcast(sessionId, { type: "tool-call", data: { toolName, args } });
}

/** Broadcast tool result to session */
export function broadcastToolResult(sessionId: string, toolName: string, result: any): void {
  wsServer.broadcast(sessionId, { type: "tool-result", data: { toolName, result } });
}
