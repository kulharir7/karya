import { NextRequest } from "next/server";
import "dotenv/config";
import { getMCPToolsets } from "@/mastra/mcp/client";
import {
  addMessage,
  getRecentMessages,
  ensureDefaultSession,
  getSession,
  createSession,
  renameSession,
} from "@/lib/session-manager";
import { eventBus } from "@/lib/event-bus";
import { getWorkspaceContext, initWorkspace, logToDaily } from "@/lib/memory-engine";
// Agent routing is now handled by the supervisor agent itself via tool calling
// (Supervisor Pattern from "Principles of Building AI Agents" book)
// The supervisor has delegate-*-agent tools and decides which specialist to call

// Cache MCP tools for 60 seconds
let mcpToolsCache: { tools: Record<string, any>; timestamp: number } = { tools: {}, timestamp: 0 };
const MCP_CACHE_TTL = 60_000;

async function getAgent() {
  const { mastra } = await import("@/mastra");
  // Always use supervisor — it delegates to specialists via tools
  return mastra.getAgent("karya");
}

async function getCachedMCPToolsets(): Promise<Record<string, any>> {
  const now = Date.now();
  if (now - mcpToolsCache.timestamp < MCP_CACHE_TTL && Object.keys(mcpToolsCache.tools).length > 0) {
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

// Map Mastra variable names → tool IDs for display
const TOOL_NAME_MAP: Record<string, string> = {
  navigateTool: "browser-navigate", actTool: "browser-act",
  extractTool: "browser-extract", screenshotTool: "browser-screenshot",
  webSearchTool: "web-search", readFileTool: "file-read",
  writeFileTool: "file-write", listFilesTool: "file-list",
  moveFileTool: "file-move", searchFilesTool: "file-search",
  readPdfTool: "file-read-pdf", resizeImageTool: "file-resize-image",
  zipFilesTool: "file-zip", unzipFilesTool: "file-unzip",
  executeCommandTool: "shell-execute", systemInfoTool: "system-info",
  clipboardReadTool: "clipboard-read", clipboardWriteTool: "clipboard-write",
  notifyTool: "system-notify", browserAgentTool: "browser-agent",
  batchRenameTool: "file-batch-rename", fileSizeTool: "file-size-info",
  dateTimeTool: "system-datetime", processListTool: "system-processes",
  openAppTool: "system-open-app", killProcessTool: "system-kill-process",
  codeWriteTool: "code-write", codeExecuteTool: "code-execute",
  codeAnalyzeTool: "code-analyze", apiCallTool: "api-call",
  csvParseTool: "data-csv-parse", jsonQueryTool: "data-json-query",
  dataTransformTool: "data-transform",
  memorySearchTool: "memory-search",
  memoryReadTool: "memory-read",
  memoryWriteTool: "memory-write",
  memoryLogTool: "memory-log",
  memoryListTool: "memory-list",
  scheduleTaskTool: "task-schedule",
  listTasksTool: "task-list",
  cancelTaskTool: "task-cancel",
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
  // Error Recovery
  suggestRecoveryTool: "suggest-recovery",
  logRecoveryTool: "log-recovery",
  confidenceCheckTool: "confidence-check",
  // Git
  gitStatusTool: "git-status",
  gitCommitTool: "git-commit",
  gitPushTool: "git-push",
  gitLogTool: "git-log",
  gitDiffTool: "git-diff",
};

function resolveToolName(raw: string): string {
  return TOOL_NAME_MAP[raw] || raw;
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId: reqSessionId } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // Resolve session — server-side
    let sessionId = reqSessionId || "default";
    await ensureDefaultSession();

    let session = await getSession(sessionId);
    if (!session) {
      session = await createSession("New Chat");
      sessionId = session.id;
    }

    // Persist user message to DB
    await addMessage(sessionId, { role: "user", content: message, timestamp: Date.now() });
    await eventBus.emit("message:received", { sessionId, message, timestamp: Date.now() });

    // Initialize workspace and get memory context
    initWorkspace();
    const workspaceContext = getWorkspaceContext();

    // Load recent messages from DB for context
    const recentMessages = await getRecentMessages(sessionId, 20);
    const contextMessages: any[] = [];

    // Inject workspace context as system message (like OpenClaw bootstrap)
    if (workspaceContext) {
      contextMessages.push({
        role: "system",
        content: `## Workspace Memory\n${workspaceContext}`,
      });
    }

    // Add chat history
    contextMessages.push(
      ...recentMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
    );

    // Auto-rename session from first user message
    if (session.messageCount <= 1) {
      const autoName = message.slice(0, 30) + (message.length > 30 ? "..." : "");
      await renameSession(sessionId, autoName);
    }

    // Supervisor handles everything — delegates to specialists via tools
    const agent = await getAgent();
    const encoder = new TextEncoder();

    // Fetch MCP toolsets
    const mcpToolsets = await getCachedMCPToolsets();
    const mcpToolCount = Object.keys(mcpToolsets).length;

    const readable = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        send({ type: "session", sessionId });
        await eventBus.emit("agent:start", { sessionId, message });

        try {
          const streamOptions: any = {};
          if (mcpToolCount > 0) {
            streamOptions.toolsets = mcpToolsets;
          }

          // === DUAL STREAM: Real-time tools + word-by-word text (Point 52) ===
          // Use fullStream for interleaved tool + text events
          // This shows tool cards DURING execution, not after
          const streamResult = await agent.stream(contextMessages, streamOptions);

          let fullText = "";
          const allToolCalls: { toolName: string; args?: any; result?: any; status: string }[] = [];
          const pendingTools: Map<string, { toolName: string; args?: any }> = new Map();

          const fullStream = (streamResult as any).fullStream;
          for await (const event of fullStream) {
            // Events can be wrapped in payload (Mastra) or direct
            const ev = event?.payload || event;
            const type = ev?.type || event?.type;

            if (type === "text-delta") {
              const delta = ev?.textDelta || ev?.content || "";
              if (delta) {
                fullText += delta;
                send({ type: "text-delta", content: delta });
              }
            } else if (type === "tool-call") {
              const rawName = ev?.toolName || ev?.name || "unknown";
              const toolName = resolveToolName(rawName);
              const args = ev?.args || {};
              const callId = ev?.toolCallId || rawName;

              pendingTools.set(callId, { toolName, args });
              await eventBus.emit("tool:before_call", { toolName, args });
              send({ type: "tool-call", toolName, args });
            } else if (type === "tool-result") {
              const rawName = ev?.toolName || ev?.name || "unknown";
              const toolName = resolveToolName(rawName);
              const callId = ev?.toolCallId || rawName;
              const result = ev?.result || null;

              send({ type: "tool-result", toolName, result });
              await eventBus.emit("tool:after_call", { toolName, result });

              const pending = pendingTools.get(callId);
              allToolCalls.push({
                toolName,
                args: pending?.args || {},
                result,
                status: "done",
              });
              pendingTools.delete(callId);
            }
            // Skip other event types (step-start, step-finish, etc.)
          }

          // Persist assistant message
          await addMessage(sessionId, {
            role: "assistant",
            content: fullText || "✅ Done.",
            toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
            timestamp: Date.now(),
          });

          // Log to daily memory
          if (allToolCalls.length > 0) {
            const toolNames = allToolCalls.map((t) => t.toolName).join(", ");
            logToDaily(`Used tools: ${toolNames} | Session: ${sessionId}`);
          }

          await eventBus.emit("agent:end", { sessionId, toolCount: allToolCalls.length, textLength: fullText.length });
          await eventBus.emit("message:sent", { sessionId, content: fullText });

          send({ type: "done" });
          controller.close();
        } catch (err: any) {
          console.error("Agent error:", err.message);
          await eventBus.emit("agent:error", { sessionId, error: err.message });

          await addMessage(sessionId, {
            role: "assistant",
            content: `❌ Error: ${err.message}`,
            timestamp: Date.now(),
          });

          send({ type: "error", content: err.message || "Agent error" });
          send({ type: "done" });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
