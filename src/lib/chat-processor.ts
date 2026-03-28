/**
 * ChatProcessor — Core chat engine extracted from /api/chat/route.ts
 * 
 * This is the HEART of Karya. Every channel uses this:
 * - SSE (web UI) → streams via ReadableStream
 * - WebSocket → streams via ws.send()
 * - CLI → streams via stdout
 * - Telegram/bridges → collects full response
 * 
 * Architecture:
 *   Input (ChatRequest) → resolve session → build context → agent.stream() → emit events → persist
 * 
 * The processor emits events via callbacks, so each transport can handle them differently.
 */

import { getMCPToolsets } from "@/mastra/mcp/client";
import {
  addMessage,
  getRecentMessages,
  ensureDefaultSession,
  getSession,
  createSession,
  renameSession,
  type StoredMessage,
} from "@/lib/session-manager";
import { eventBus } from "@/lib/event-bus";
import { getWorkspaceContext, initWorkspace, logToDaily } from "@/lib/memory-engine";
import { getRelevantLessons, runSelfReview } from "@/lib/self-improving";
import { getActivePluginSkills, matchPlugins, loadPluginSkill } from "@/lib/plugin-registry";
// Import audit-log to auto-register event bus hooks (side effect import)
import "@/lib/audit-log";

// ============================================
// TYPES
// ============================================

/** Image attachment for vision support */
export interface ImageAttachment {
  base64: string;
  mimeType: string;
  name?: string;
}

/** Input to the chat processor */
export interface ChatRequest {
  message: string;
  sessionId?: string;
  images?: ImageAttachment[];
  /** Which channel sent this (for logging) */
  channel?: "web" | "cli" | "ws" | "telegram" | "whatsapp" | "discord" | "api";
  /** Max steps for agentic loop (default: 15) */
  maxSteps?: number;
  /** Max context messages to load (default: 20) */
  contextWindow?: number;
}

/** A single tool call record */
export interface ToolCallRecord {
  toolName: string;
  args?: any;
  result?: any;
  status: "running" | "done" | "error";
}

/** Events emitted during chat processing */
export interface ChatEvents {
  /** Session resolved/created */
  onSession?: (sessionId: string) => void;
  /** Text token streamed */
  onTextDelta?: (delta: string) => void;
  /** Tool execution started */
  onToolCall?: (toolName: string, args: any) => void;
  /** Tool execution finished */
  onToolResult?: (toolName: string, result: any) => void;
  /** Processing complete */
  onDone?: (result: ChatResult) => void;
  /** Error occurred */
  onError?: (error: string) => void;
}

/** Final result after processing */
export interface ChatResult {
  sessionId: string;
  text: string;
  toolCalls: ToolCallRecord[];
  tokenEstimate: number;
  durationMs: number;
}

// ============================================
// TOOL NAME MAP (Mastra variable → display ID)
// ============================================

const TOOL_NAME_MAP: Record<string, string> = {
  // Browser
  navigateTool: "browser-navigate",
  actTool: "browser-act",
  extractTool: "browser-extract",
  screenshotTool: "browser-screenshot",
  webSearchTool: "web-search",
  browserAgentTool: "browser-agent",
  // Files
  readFileTool: "file-read",
  writeFileTool: "file-write",
  listFilesTool: "file-list",
  moveFileTool: "file-move",
  searchFilesTool: "file-search",
  readPdfTool: "file-read-pdf",
  resizeImageTool: "file-resize-image",
  zipFilesTool: "file-zip",
  unzipFilesTool: "file-unzip",
  batchRenameTool: "file-batch-rename",
  fileSizeTool: "file-size-info",
  // Shell
  executeCommandTool: "shell-execute",
  // System
  systemInfoTool: "system-info",
  dateTimeTool: "system-datetime",
  processListTool: "system-processes",
  openAppTool: "system-open-app",
  killProcessTool: "system-kill-process",
  clipboardReadTool: "clipboard-read",
  clipboardWriteTool: "clipboard-write",
  notifyTool: "system-notify",
  systemScreenshotTool: "system-screenshot",
  analyzeImageTool: "analyze-image",
  // Code
  codeWriteTool: "code-write",
  codeExecuteTool: "code-execute",
  codeAnalyzeTool: "code-analyze",
  // Data
  apiCallTool: "api-call",
  csvParseTool: "data-csv-parse",
  jsonQueryTool: "data-json-query",
  dataTransformTool: "data-transform",
  // Memory
  memorySearchTool: "memory-search",
  memoryReadTool: "memory-read",
  memoryWriteTool: "memory-write",
  memoryLogTool: "memory-log",
  memoryListTool: "memory-list",
  memoryRecallTool: "memory-recall",
  // Scheduler
  scheduleTaskTool: "task-schedule",
  listTasksTool: "task-list",
  cancelTaskTool: "task-cancel",
  // Agent delegation
  delegateToBrowserAgent: "delegate-browser-agent",
  delegateToFileAgent: "delegate-file-agent",
  delegateToCoderAgent: "delegate-coder-agent",
  delegateToResearcherAgent: "delegate-researcher-agent",
  delegateToDataAnalystAgent: "delegate-data-analyst-agent",
  passContextToAgent: "pass-context",
  agentHandoffTool: "agent-handoff",
  codeReviewTool: "code-review",
  // Planning
  createPlanTool: "create-plan",
  executePlanStepTool: "execute-plan-step",
  reviewOutputTool: "review-output",
  getPlanStatusTool: "get-plan-status",
  // Recovery
  suggestRecoveryTool: "suggest-recovery",
  logRecoveryTool: "log-recovery",
  confidenceCheckTool: "confidence-check",
  // Git
  gitStatusTool: "git-status",
  gitCommitTool: "git-commit",
  gitPushTool: "git-push",
  gitLogTool: "git-log",
  gitDiffTool: "git-diff",
  // Skills
  skillListTool: "skill-list",
  skillMatchTool: "skill-match",
  skillLoadTool: "skill-load",
  skillCreateTool: "skill-create",
  // Workflows
  workflowListTool: "workflow-list",
  workflowRunTool: "workflow-run",
  workflowStatusTool: "workflow-status",
  workflowHistoryTool: "workflow-history",
  workflowResumeTool: "workflow-resume",
  workflowCancelTool: "workflow-cancel",
  workflowStatsTool: "workflow-stats",
  // Triggers
  triggerCreateTool: "trigger-create",
  triggerListTool: "trigger-list",
  triggerDeleteTool: "trigger-delete",
  triggerToggleTool: "trigger-toggle",
  // Plugins
  pluginListTool: "plugin-list",
  pluginCreateTool: "plugin-create",
  pluginInstallTool: "plugin-install",
  pluginToggleTool: "plugin-toggle",
  pluginUninstallTool: "plugin-uninstall",
};

export function resolveToolName(raw: string): string {
  return TOOL_NAME_MAP[raw] || raw;
}

/** Get all tool display names (for dynamic tool listing) */
export function getAllToolNames(): string[] {
  return [...new Set(Object.values(TOOL_NAME_MAP))];
}

/** Get tools grouped by category */
export function getToolsByCategory(): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    browser: [],
    files: [],
    shell: [],
    system: [],
    code: [],
    data: [],
    memory: [],
    scheduler: [],
    agents: [],
    planning: [],
    recovery: [],
    git: [],
    skills: [],
    workflows: [],
    triggers: [],
    plugins: [],
  };

  for (const [varName, displayName] of Object.entries(TOOL_NAME_MAP)) {
    if (displayName.startsWith("browser-") || displayName === "web-search") {
      categories.browser.push(displayName);
    } else if (displayName.startsWith("file-")) {
      categories.files.push(displayName);
    } else if (displayName.startsWith("shell-")) {
      categories.shell.push(displayName);
    } else if (
      displayName.startsWith("system-") ||
      displayName.startsWith("clipboard-") ||
      displayName === "analyze-image"
    ) {
      categories.system.push(displayName);
    } else if (displayName.startsWith("code-")) {
      categories.code.push(displayName);
    } else if (
      displayName.startsWith("data-") ||
      displayName === "api-call"
    ) {
      categories.data.push(displayName);
    } else if (displayName.startsWith("memory-")) {
      categories.memory.push(displayName);
    } else if (displayName.startsWith("task-")) {
      categories.scheduler.push(displayName);
    } else if (
      displayName.startsWith("delegate-") ||
      displayName === "pass-context" ||
      displayName === "agent-handoff" ||
      displayName === "code-review"
    ) {
      categories.agents.push(displayName);
    } else if (
      displayName.startsWith("create-plan") ||
      displayName.startsWith("execute-plan") ||
      displayName === "review-output" ||
      displayName === "get-plan-status"
    ) {
      categories.planning.push(displayName);
    } else if (
      displayName.startsWith("suggest-") ||
      displayName.startsWith("log-recovery") ||
      displayName === "confidence-check"
    ) {
      categories.recovery.push(displayName);
    } else if (displayName.startsWith("git-")) {
      categories.git.push(displayName);
    } else if (displayName.startsWith("skill-")) {
      categories.skills.push(displayName);
    } else if (displayName.startsWith("workflow-")) {
      categories.workflows.push(displayName);
    } else if (displayName.startsWith("trigger-")) {
      categories.triggers.push(displayName);
    } else if (displayName.startsWith("plugin-")) {
      categories.plugins.push(displayName);
    }
  }

  // Deduplicate
  for (const cat of Object.keys(categories)) {
    categories[cat] = [...new Set(categories[cat])];
  }

  return categories;
}

// ============================================
// PLUGIN LOADING FLAG
// ============================================

let pluginsLoaded = false;

// ============================================
// MCP CACHE
// ============================================

let mcpToolsCache: { tools: Record<string, any>; timestamp: number } = {
  tools: {},
  timestamp: 0,
};
const MCP_CACHE_TTL = 60_000;

async function getCachedMCPToolsets(): Promise<Record<string, any>> {
  const now = Date.now();
  if (
    now - mcpToolsCache.timestamp < MCP_CACHE_TTL &&
    Object.keys(mcpToolsCache.tools).length > 0
  ) {
    return mcpToolsCache.tools;
  }
  try {
    const toolsets = await getMCPToolsets();
    mcpToolsCache = { tools: toolsets, timestamp: now };
    return toolsets;
  } catch {
    return mcpToolsCache.tools;
  }
}

// ============================================
// AGENT LOADER
// ============================================

async function getAgent() {
  const { mastra } = await import("@/mastra");
  return mastra.getAgent("karya");
}

// ============================================
// MAIN PROCESSOR
// ============================================

/**
 * Process a chat message through the agent.
 * 
 * This is the core function. Every transport (SSE, WS, CLI, bridges) calls this.
 * Events are emitted via callbacks so each transport handles output differently.
 * 
 * @returns ChatResult with full text, tool calls, and timing info
 */
export async function processChat(
  request: ChatRequest,
  events: ChatEvents = {}
): Promise<ChatResult> {
  const startTime = Date.now();
  const {
    message,
    sessionId: reqSessionId,
    images,
    channel = "web",
    maxSteps = 15,
    contextWindow = 20,
  } = request;

  // ---- 1. Resolve session ----
  let sessionId = reqSessionId || "default";
  await ensureDefaultSession();

  let session = await getSession(sessionId);
  if (!session) {
    session = await createSession("New Chat");
    sessionId = session.id;
  }

  events.onSession?.(sessionId);

  // ---- 2. Persist user message ----
  await addMessage(sessionId, {
    role: "user",
    content: message,
    timestamp: Date.now(),
  });
  await eventBus.emit("message:received", {
    sessionId,
    message,
    channel,
    timestamp: Date.now(),
  });

  // ---- 3. Build context ----
  initWorkspace();

  // Auto-load plugins on first chat (lazy init)
  if (!pluginsLoaded) {
    try {
      const { loadAllPlugins } = await import("@/lib/plugin-registry");
      await loadAllPlugins();
      pluginsLoaded = true;
    } catch {
      // Non-critical
    }
  }

  const workspaceContext = getWorkspaceContext();

  const recentMessages = await getRecentMessages(sessionId, contextWindow);
  const contextMessages: any[] = [];

  // Workspace context as system message
  if (workspaceContext) {
    contextMessages.push({
      role: "system",
      content: workspaceContext,
    });
  }

  // Inject relevant lessons from past tasks (self-improving)
  const lessons = getRelevantLessons(message);
  if (lessons) {
    contextMessages.push({
      role: "system",
      content: lessons,
    });
  }

  // Inject active plugin skills (Phase 6)
  // First: check if any plugins match this specific query
  const matchedPlugins = matchPlugins(message);
  if (matchedPlugins.length > 0) {
    // Load full SKILL.md for matched plugins (targeted injection)
    const matchedSkills: string[] = [];
    for (const mp of matchedPlugins.slice(0, 2)) { // Max 2 matched skills
      const skill = loadPluginSkill(mp.id);
      if (skill) {
        matchedSkills.push(`### Plugin: ${mp.manifest.name}\n${skill}`);
      }
    }
    if (matchedSkills.length > 0) {
      contextMessages.push({
        role: "system",
        content: `## 🔌 Matched Plugins for This Task\n\n${matchedSkills.join("\n\n---\n\n")}`,
      });
    }
  } else {
    // No specific match — inject catalog summary (lightweight)
    const pluginSkills = getActivePluginSkills();
    if (pluginSkills) {
      contextMessages.push({
        role: "system",
        content: pluginSkills,
      });
    }
  }

  // Chat history (excluding current message — we add it below with images)
  contextMessages.push(
    ...recentMessages.slice(0, -1).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))
  );

  // Current user message (with images if present)
  if (images && images.length > 0) {
    const contentParts: any[] = [{ type: "text", text: message }];
    for (const img of images) {
      contentParts.push({
        type: "image",
        image: `data:${img.mimeType};base64,${img.base64}`,
      });
    }
    contextMessages.push({ role: "user", content: contentParts });
  } else {
    contextMessages.push({ role: "user", content: message });
  }

  // ---- 4. Auto-rename session from first message ----
  if (session.messageCount <= 1) {
    const autoName =
      message.slice(0, 30) + (message.length > 30 ? "..." : "");
    await renameSession(sessionId, autoName);
  }

  // ---- 5. Stream from agent ----
  const agent = await getAgent();
  const mcpToolsets = await getCachedMCPToolsets();
  const mcpToolCount = Object.keys(mcpToolsets).length;

  await eventBus.emit("agent:start", { sessionId, message, channel });

  let fullText = "";
  const allToolCalls: ToolCallRecord[] = [];
  const pendingTools = new Map<string, { toolName: string; args?: any }>();

  try {
    const streamOptions: any = { maxSteps };
    if (mcpToolCount > 0) {
      streamOptions.toolsets = mcpToolsets;
    }

    const streamResult = await agent.stream(contextMessages, streamOptions);
    const fullStream = (streamResult as any).fullStream;

    for await (const event of fullStream) {
      const ev = event?.payload || event;
      const type = ev?.type || event?.type;

      if (type === "text-delta") {
        const delta =
          event?.payload?.text ||
          event?.payload?.textDelta ||
          ev?.text ||
          ev?.textDelta ||
          "";
        if (delta) {
          fullText += delta;
          events.onTextDelta?.(delta);
        }
      } else if (type === "tool-call") {
        const rawName = ev?.toolName || ev?.name || "unknown";
        const toolName = resolveToolName(rawName);
        const args = ev?.args || {};
        const callId = ev?.toolCallId || rawName;

        pendingTools.set(callId, { toolName, args });
        await eventBus.emit("tool:before_call", { toolName, args, sessionId });
        events.onToolCall?.(toolName, args);
      } else if (type === "tool-result") {
        const rawName = ev?.toolName || ev?.name || "unknown";
        const toolName = resolveToolName(rawName);
        const callId = ev?.toolCallId || rawName;
        const result = ev?.result || null;

        await eventBus.emit("tool:after_call", { toolName, result, sessionId });
        events.onToolResult?.(toolName, result);

        const pending = pendingTools.get(callId);
        allToolCalls.push({
          toolName,
          args: pending?.args || {},
          result,
          status: "done",
        });
        pendingTools.delete(callId);
      }
      // Skip step-start, step-finish, etc.
    }
  } catch (err: any) {
    const errorMsg = err.message || "Agent error";
    console.error(`[chat-processor] Error (${channel}):`, errorMsg);
    await eventBus.emit("agent:error", { sessionId, error: errorMsg, channel });

    // Persist error message
    await addMessage(sessionId, {
      role: "assistant",
      content: `❌ Error: ${errorMsg}`,
      timestamp: Date.now(),
    });

    events.onError?.(errorMsg);

    return {
      sessionId,
      text: "",
      toolCalls: allToolCalls,
      tokenEstimate: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // ---- 6. Persist assistant response ----
  const responseContent =
    fullText ||
    (allToolCalls.length > 0
      ? "✅ Done."
      : "⚠️ No response from AI. Check Settings → API keys.");

  await addMessage(sessionId, {
    role: "assistant",
    content: responseContent,
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    timestamp: Date.now(),
  });

  // ---- 7. Log to daily memory ----
  if (allToolCalls.length > 0) {
    const toolNames = allToolCalls.map((t) => t.toolName).join(", ");
    logToDaily(`[${channel}] Tools: ${toolNames} | Session: ${sessionId}`);
  }

  // ---- 8. Emit completion events ----
  const tokenEstimate = Math.ceil(
    (fullText.length + JSON.stringify(allToolCalls).length) / 4
  );

  await eventBus.emit("agent:end", {
    sessionId,
    toolCount: allToolCalls.length,
    textLength: fullText.length,
    channel,
  });
  await eventBus.emit("message:sent", {
    sessionId,
    content: fullText,
    channel,
  });

  const result: ChatResult = {
    sessionId,
    text: fullText,
    toolCalls: allToolCalls,
    tokenEstimate,
    durationMs: Date.now() - startTime,
  };

  events.onDone?.(result);

  // ---- 9. Self-review (async, fire-and-forget — never blocks response) ----
  if (allToolCalls.length > 0 && (channel as string) !== "heartbeat") {
    const toolNames = allToolCalls.map((t) => t.toolName);
    runSelfReview(message, fullText, toolNames, result.durationMs).catch(() => {
      // Self-review failure is never critical
    });
  }

  return result;
}

/**
 * Process chat and collect full response (non-streaming).
 * Useful for bridges (Telegram, WhatsApp) that need the full text at once.
 */
export async function processChatSync(
  request: ChatRequest
): Promise<ChatResult> {
  return processChat(request, {});
}
