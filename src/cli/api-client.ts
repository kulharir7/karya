/**
 * Karya CLI API Client — Talks to Karya server via REST API v1
 * 
 * This is the CLI's only connection to the server.
 * All commands go through here: chat, sessions, tools, status, etc.
 * 
 * Uses:
 * - fetch() for regular REST calls
 * - SSE parsing for streaming chat responses
 * - Configurable base URL and auth token
 */

const DEFAULT_URL = "http://localhost:3000";
const DEFAULT_TIMEOUT = 120_000; // 2 minutes for chat

// ============================================
// CONFIG
// ============================================

export interface CLIConfig {
  apiUrl: string;
  token: string;
  sessionId: string;
}

let config: CLIConfig = {
  apiUrl: process.env.KARYA_API_URL || DEFAULT_URL,
  token: process.env.KARYA_TOKEN || "",
  sessionId: process.env.KARYA_SESSION || "cli-default",
};

export function getConfig(): CLIConfig {
  return { ...config };
}

export function setConfig(updates: Partial<CLIConfig>): void {
  config = { ...config, ...updates };
}

// ============================================
// HTTP HELPERS
// ============================================

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.token) {
    headers["Authorization"] = `Bearer ${config.token}`;
  }
  return headers;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiJson = { ok?: boolean; data?: any; error?: { message?: string }; [key: string]: any };

function extractError(body: ApiJson, status: number, statusText: string): string {
  return body?.error?.message || `HTTP ${status}: ${statusText}`;
}

/**
 * Generic API request to v1 endpoints.
 * Parses response as { ok, data, error, meta }.
 */
export async function apiGet(path: string): Promise<any> {
  const url = `${config.apiUrl}/api/v1${path}`;
  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiJson;
    throw new Error(extractError(body, res.status, res.statusText));
  }

  const json = (await res.json()) as ApiJson;
  if (json.ok === false) {
    throw new Error(json.error?.message || "API error");
  }
  return json.data;
}

export async function apiPost(path: string, body: any = {}): Promise<any> {
  const url = `${config.apiUrl}/api/v1${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiJson;
    throw new Error(extractError(data, res.status, res.statusText));
  }

  const json = (await res.json()) as ApiJson;
  if (json.ok === false) {
    throw new Error(json.error?.message || "API error");
  }
  return json.data;
}

export async function apiPut(path: string, body: any = {}): Promise<any> {
  const url = `${config.apiUrl}/api/v1${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiJson;
    throw new Error(extractError(data, res.status, res.statusText));
  }

  const json = (await res.json()) as ApiJson;
  if (json.ok === false) {
    throw new Error(json.error?.message || "API error");
  }
  return json.data;
}

export async function apiDelete(path: string): Promise<void> {
  const url = `${config.apiUrl}/api/v1${path}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!res.ok && res.status !== 204) {
    const data = (await res.json().catch(() => ({}))) as ApiJson;
    throw new Error(extractError(data, res.status, res.statusText));
  }
}

// ============================================
// SSE STREAMING
// ============================================

/** Events emitted during SSE streaming */
export interface StreamEvents {
  onSession?: (sessionId: string) => void;
  onTextDelta?: (delta: string) => void;
  onToolCall?: (toolName: string, args?: any) => void;
  onToolResult?: (toolName: string, result?: any) => void;
  onDone?: (info: { sessionId?: string; durationMs?: number; toolCount?: number; tokenEstimate?: number }) => void;
  onError?: (error: string) => void;
}

/**
 * Send a chat message and stream the response via SSE.
 * 
 * This parses the `data: {...}\n\n` SSE format from /api/v1/chat.
 * Each event is dispatched to the appropriate callback.
 */
export async function streamChat(
  message: string,
  sessionId: string,
  events: StreamEvents,
  signal?: AbortSignal
): Promise<void> {
  const url = `${config.apiUrl}/api/v1/chat`;

  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message, sessionId, stream: true }),
    signal,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiJson;
    events.onError?.(body?.error?.message || `HTTP ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    events.onError?.("No response stream");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete last line in buffer

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;

      try {
        const evt = JSON.parse(jsonStr);

        switch (evt.type) {
          case "session":
            events.onSession?.(evt.sessionId || "");
            break;

          case "text-delta":
            if (evt.content) {
              events.onTextDelta?.(evt.content);
            }
            break;

          case "tool-call":
            events.onToolCall?.(evt.toolName || "unknown", evt.args);
            break;

          case "tool-result":
            events.onToolResult?.(evt.toolName || "unknown", evt.result);
            break;

          case "done":
            events.onDone?.({
              sessionId: evt.sessionId,
              durationMs: evt.durationMs,
              toolCount: evt.toolCount,
              tokenEstimate: evt.tokenEstimate,
            });
            break;

          case "error":
            events.onError?.(evt.content || evt.message || "Unknown error");
            break;
        }
      } catch {
        // Skip unparseable lines
      }
    }
  }
}

// ============================================
// HIGH-LEVEL API METHODS
// ============================================

// ---- Sessions ----

export async function listSessions(): Promise<any[]> {
  const data = await apiGet("/sessions?limit=50");
  return data || [];
}

export async function getSession(id: string): Promise<any> {
  return apiGet(`/sessions/${encodeURIComponent(id)}`);
}

export async function createSession(name?: string): Promise<any> {
  return apiPost("/sessions", { name });
}

export async function renameSession(id: string, name: string): Promise<any> {
  return apiPut(`/sessions/${encodeURIComponent(id)}`, { name });
}

export async function deleteSession(id: string): Promise<void> {
  return apiDelete(`/sessions/${encodeURIComponent(id)}`);
}

export async function clearSession(id: string): Promise<any> {
  return apiPut(`/sessions/${encodeURIComponent(id)}`, { action: "clear" });
}

export async function getMessages(id: string, limit: number = 20): Promise<any[]> {
  const data = await apiGet(`/sessions/${encodeURIComponent(id)}/messages?limit=${limit}`);
  return data || [];
}

// ---- Tools ----

export async function listTools(): Promise<any> {
  return apiGet("/tools");
}

export async function listToolsByCategory(category: string): Promise<any> {
  return apiGet(`/tools?category=${encodeURIComponent(category)}`);
}

export async function searchTools(query: string): Promise<any> {
  return apiGet(`/tools?search=${encodeURIComponent(query)}`);
}

export async function runTool(toolId: string, args: any = {}): Promise<any> {
  return apiPost(`/tools/${encodeURIComponent(toolId)}`, { args });
}

// ---- Agents ----

export async function listAgents(): Promise<any> {
  return apiGet("/agents");
}

// ---- Status ----

export async function getStatus(): Promise<any> {
  return apiGet("/status");
}

export async function getHealth(): Promise<any> {
  const url = `${config.apiUrl}/api/v1/health`;
  const res = await fetch(url, { headers: authHeaders() });
  return res.json();
}

// ---- Memory ----

export async function searchMemory(query: string): Promise<any> {
  return apiGet(`/memory?q=${encodeURIComponent(query)}`);
}

export async function readMemoryFile(file: string): Promise<any> {
  return apiGet(`/memory?file=${encodeURIComponent(file)}`);
}

export async function getDailyLog(date?: string): Promise<any> {
  return apiGet(`/memory/daily${date ? `?date=${date}` : ""}`);
}

// ---- Tasks ----

export async function listTasks(): Promise<any> {
  return apiGet("/tasks");
}

// ---- Workflows ----

export async function listWorkflows(): Promise<any> {
  return apiGet("/workflows");
}

// ---- MCP ----

export async function listMCPServers(): Promise<any> {
  return apiGet("/mcp/servers");
}

// ---- Tokens ----

export async function createToken(name: string, scopes: string[] = ["*"]): Promise<any> {
  return apiPost("/auth/tokens", { action: "create", name, scopes });
}

export async function listTokens(): Promise<any> {
  return apiGet("/auth/tokens");
}

// ---- WebSocket ----

export async function getWSStatus(): Promise<any> {
  return apiGet("/ws");
}

// ---- Server check ----

export async function isServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${config.apiUrl}/api/v1/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
