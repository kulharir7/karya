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
import { routeMessage, type AgentType } from "@/lib/agent-router";

// Cache MCP tools for 60 seconds
let mcpToolsCache: { tools: Record<string, any>; timestamp: number } = { tools: {}, timestamp: 0 };
const MCP_CACHE_TTL = 60_000;

// Agent ID mapping for routing
const AGENT_ID_MAP: Record<AgentType, string> = {
  supervisor: "karya",
  browser: "karya-browser",
  file: "karya-file",
  coder: "karya-coder",
  researcher: "karya-researcher",
  "data-analyst": "karya-data-analyst",
};

async function getAgent(agentType: AgentType = "supervisor") {
  const { mastra } = await import("@/mastra");
  const agentId = AGENT_ID_MAP[agentType] || "karya";
  try {
    return mastra.getAgent(agentId as any);
  } catch {
    // Fallback to supervisor if agent not found
    return mastra.getAgent("karya");
  }
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

    // Route message to the best specialist agent
    const route = routeMessage(message);
    const agent = await getAgent(route.agent);
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
        send({
          type: "agent-route",
          agent: route.agent,
          confidence: route.confidence,
          reason: route.reason,
        });
        await eventBus.emit("agent:start", { sessionId, message, agent: route.agent, confidence: route.confidence });

        try {
          const streamOptions: any = {};
          if (mcpToolCount > 0) {
            streamOptions.toolsets = mcpToolsets;
          }

          // === TRUE STREAMING via agent.stream() ===
          const streamResult = await agent.stream(contextMessages, streamOptions);

          let fullText = "";
          const allToolCalls: { toolName: string; args?: any; result?: any; status: string }[] = [];

          // Stream text token-by-token via textStream
          const textStream = await streamResult.textStream;
          for await (const chunk of textStream) {
            if (chunk) {
              fullText += chunk;
              send({ type: "text-delta", content: chunk });
            }
          }

          // After stream ends, get tool calls from steps
          const steps = await streamResult.steps;
          if (steps && Array.isArray(steps)) {
            for (const step of steps) {
              const toolCalls = step?.toolCalls || [];
              const toolResults = step?.toolResults || [];

              for (let i = 0; i < toolCalls.length; i++) {
                const tc = toolCalls[i];
                const tr = toolResults[i];
                const tcPayload = tc?.payload || tc;
                const trPayload = tr?.payload || tr;
                const rawName = (tcPayload as any)?.toolName || (tcPayload as any)?.name || (tc as any)?.toolName || "unknown";
                const toolName = resolveToolName(rawName);
                const toolResult = trPayload?.result || null;

                await eventBus.emit("tool:before_call", { toolName, args: tcPayload?.args || {} });
                send({ type: "tool-call", toolName, args: tcPayload?.args || {} });

                if (tr) {
                  send({ type: "tool-result", toolName, result: toolResult });
                  await eventBus.emit("tool:after_call", { toolName, result: toolResult });
                }

                allToolCalls.push({
                  toolName, args: tcPayload?.args || {},
                  result: toolResult, status: tr ? "done" : "error",
                });
              }
            }
          }

          // Get final text if textStream was empty (fallback)
          if (!fullText) {
            try {
              fullText = await streamResult.text || "";
              if (fullText) {
                send({ type: "text-delta", content: fullText });
              }
            } catch {}
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
            logToDaily(`[${route.agent}] Used tools: ${toolNames} | Session: ${sessionId}`);
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
