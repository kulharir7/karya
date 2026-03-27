/**
 * Karya WebSocket Server — Real-time bidirectional communication
 * 
 * Features:
 * - Persistent connections (no reconnect per message)
 * - Multiple clients simultaneously
 * - Real-time streaming (text-delta, tool-call, tool-result)
 * - Session isolation
 * - Heartbeat/ping-pong
 */

import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";
import { eventBus } from "./event-bus";

// Message types
export type WSMessageType =
  | "chat"           // User sends message
  | "text-delta"     // Streaming text chunk
  | "text"           // Complete text
  | "tool-call"      // Tool execution started
  | "tool-result"    // Tool execution finished
  | "error"          // Error occurred
  | "session"        // Session events
  | "ping"           // Heartbeat
  | "pong"           // Heartbeat response
  | "subscribe"      // Subscribe to session
  | "unsubscribe";   // Unsubscribe from session

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
}

// WebSocket Server class
class KaryaWebSocketServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private port: number;

  constructor(port: number = 3002) {
    super();
    this.port = port;
  }

  /**
   * Start the WebSocket server
   */
  start(): void {
    if (this.wss) {
      console.log("[ws] Server already running");
      return;
    }

    this.wss = new WebSocketServer({ port: this.port });
    console.log(`[ws] WebSocket server started on port ${this.port}`);

    this.wss.on("connection", (ws, req) => {
      const clientId = this.generateClientId();
      const client: WSClient = {
        id: clientId,
        ws,
        sessionId: null,
        connectedAt: Date.now(),
        lastPing: Date.now(),
      };

      this.clients.set(clientId, client);
      console.log(`[ws] Client connected: ${clientId} (total: ${this.clients.size})`);

      // Send welcome message
      this.send(ws, {
        type: "session",
        data: { event: "connected", clientId },
      });

      // Handle messages
      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString()) as WSMessage;
          this.handleMessage(client, message);
        } catch (err) {
          this.send(ws, {
            type: "error",
            data: { message: "Invalid JSON" },
          });
        }
      });

      // Handle close
      ws.on("close", () => {
        this.clients.delete(clientId);
        console.log(`[ws] Client disconnected: ${clientId} (total: ${this.clients.size})`);
      });

      // Handle error
      ws.on("error", (err) => {
        console.error(`[ws] Client error ${clientId}:`, err.message);
      });
    });

    // Start heartbeat checker
    this.startHeartbeat();

    // Hook into event bus for broadcasting
    this.setupEventBusHooks();
  }

  /**
   * Stop the WebSocket server
   */
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.wss) {
      // Close all client connections
      this.clients.forEach((client) => {
        client.ws.close(1000, "Server shutting down");
      });
      this.clients.clear();

      this.wss.close();
      this.wss = null;
      console.log("[ws] WebSocket server stopped");
    }
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(client: WSClient, message: WSMessage): void {
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
            data: { event: "subscribed" },
          });
          console.log(`[ws] Client ${client.id} subscribed to session ${sessionId}`);
        }
        break;

      case "unsubscribe":
        client.sessionId = null;
        this.send(client.ws, {
          type: "session",
          data: { event: "unsubscribed" },
        });
        break;

      case "chat":
        // Emit chat message for processing
        this.emit("chat", {
          clientId: client.id,
          sessionId: sessionId || client.sessionId || "default",
          message: data?.message || data,
        });
        break;

      default:
        console.log(`[ws] Unknown message type: ${type}`);
    }
  }

  /**
   * Send message to a WebSocket client
   */
  private send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...message, timestamp: Date.now() }));
    }
  }

  /**
   * Broadcast to all clients subscribed to a session
   */
  broadcast(sessionId: string, message: Omit<WSMessage, "sessionId">): void {
    const fullMessage: WSMessage = { ...message, sessionId, timestamp: Date.now() };
    const json = JSON.stringify(fullMessage);

    this.clients.forEach((client) => {
      if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(json);
      }
    });
  }

  /**
   * Broadcast to ALL connected clients
   */
  broadcastAll(message: WSMessage): void {
    const json = JSON.stringify({ ...message, timestamp: Date.now() });

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(json);
      }
    });
  }

  /**
   * Send to a specific client
   */
  sendToClient(clientId: string, message: WSMessage): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.send(client.ws, message);
    }
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients for a session
   */
  getSessionClients(sessionId: string): string[] {
    const clients: string[] = [];
    this.clients.forEach((client) => {
      if (client.sessionId === sessionId) {
        clients.push(client.id);
      }
    });
    return clients;
  }

  /**
   * Start heartbeat checker (remove stale connections)
   */
  private startHeartbeat(): void {
    const HEARTBEAT_INTERVAL = 30000; // 30 seconds
    const HEARTBEAT_TIMEOUT = 60000; // 60 seconds

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      this.clients.forEach((client, id) => {
        if (now - client.lastPing > HEARTBEAT_TIMEOUT) {
          console.log(`[ws] Client ${id} timed out, disconnecting`);
          client.ws.terminate();
          this.clients.delete(id);
        }
      });
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Hook into event bus to broadcast events
   */
  private setupEventBusHooks(): void {
    // Agent events
    eventBus.on("agent:start", (data) => {
      if (data.sessionId) {
        this.broadcast(data.sessionId, { type: "session", data: { event: "agent_start" } });
      }
    });

    eventBus.on("agent:end", (data) => {
      if (data.sessionId) {
        this.broadcast(data.sessionId, { type: "session", data: { event: "agent_end" } });
      }
    });

    // Tool events
    eventBus.on("tool:before_call", (data) => {
      if (data.sessionId) {
        this.broadcast(data.sessionId, {
          type: "tool-call",
          data: { tool: data.tool, args: data.args },
        });
      }
    });

    eventBus.on("tool:after_call", (data) => {
      if (data.sessionId) {
        this.broadcast(data.sessionId, {
          type: "tool-result",
          data: { tool: data.tool, result: data.result },
        });
      }
    });

    // Workflow events — broadcast to all clients (workflows are global)
    eventBus.on("workflow:start", (data) => {
      this.broadcastAll({
        type: "session",
        data: { event: "workflow_start", runId: data.runId, workflowId: data.workflowId },
      });
    });

    eventBus.on("workflow:complete", (data) => {
      this.broadcastAll({
        type: "session",
        data: { event: "workflow_complete", runId: data.runId, workflowId: data.workflowId, status: data.status },
      });
    });

    eventBus.on("workflow:error", (data) => {
      this.broadcastAll({
        type: "session",
        data: { event: "workflow_error", runId: data.runId, workflowId: data.workflowId, error: data.error },
      });
    });

    eventBus.on("workflow:resume", (data) => {
      this.broadcastAll({
        type: "session",
        data: { event: "workflow_resume", runId: data.runId, workflowId: data.workflowId },
      });
    });

    eventBus.on("workflow:updated", (data) => {
      this.broadcastAll({
        type: "session",
        data: { event: "workflow_updated", runId: data.runId, updates: data.updates },
      });
    });
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

// Singleton instance
export const wsServer = new KaryaWebSocketServer(
  parseInt(process.env.KARYA_WS_PORT || "3002")
);

// Helper functions
export function startWebSocketServer(): void {
  wsServer.start();
}

export function stopWebSocketServer(): void {
  wsServer.stop();
}

export function broadcastToSession(sessionId: string, type: WSMessageType, data: any): void {
  wsServer.broadcast(sessionId, { type, data });
}

export function broadcastTextDelta(sessionId: string, delta: string): void {
  wsServer.broadcast(sessionId, { type: "text-delta", data: { delta } });
}

export function broadcastToolCall(sessionId: string, tool: string, args: any): void {
  wsServer.broadcast(sessionId, { type: "tool-call", data: { tool, args } });
}

export function broadcastToolResult(sessionId: string, tool: string, result: any): void {
  wsServer.broadcast(sessionId, { type: "tool-result", data: { tool, result } });
}
