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

// Cache MCP tools for 60 seconds
let mcpToolsCache: { tools: Record<string, any>; timestamp: number } = { tools: {}, timestamp: 0 };
const MCP_CACHE_TTL = 60_000;

async function getAgent() {
  const { mastra } = await import("@/mastra");
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
  navigateTool: "browser-navigate",
  actTool: "browser-act",
  extractTool: "browser-extract",
  screenshotTool: "browser-screenshot",
  webSearchTool: "web-search",
  readFileTool: "file-read",
  writeFileTool: "file-write",
  listFilesTool: "file-list",
  moveFileTool: "file-move",
  searchFilesTool: "file-search",
  readPdfTool: "file-read-pdf",
  resizeImageTool: "file-resize-image",
  zipFilesTool: "file-zip",
  unzipFilesTool: "file-unzip",
  executeCommandTool: "shell-execute",
  systemInfoTool: "system-info",
  clipboardReadTool: "clipboard-read",
  clipboardWriteTool: "clipboard-write",
  notifyTool: "system-notify",
  browserAgentTool: "browser-agent",
  batchRenameTool: "file-batch-rename",
  fileSizeTool: "file-size-info",
  dateTimeTool: "system-datetime",
  processListTool: "system-processes",
  openAppTool: "system-open-app",
  killProcessTool: "system-kill-process",
  codeWriteTool: "code-write",
  codeExecuteTool: "code-execute",
  codeAnalyzeTool: "code-analyze",
  apiCallTool: "api-call",
  csvParseTool: "data-csv-parse",
  jsonQueryTool: "data-json-query",
  dataTransformTool: "data-transform",
};

function resolveToolName(raw: string): string {
  return TOOL_NAME_MAP[raw] || raw;
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId: reqSessionId } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Resolve session — server-side
    let sessionId = reqSessionId || "default";
    await ensureDefaultSession();
    
    let session = await getSession(sessionId);
    if (!session) {
      // Create session if it doesn't exist
      session = await createSession("New Chat");
      sessionId = session.id;
    }

    // Persist user message to DB
    await addMessage(sessionId, {
      role: "user",
      content: message,
      timestamp: Date.now(),
    });

    // Emit lifecycle events
    await eventBus.emit("message:received", { sessionId, message, timestamp: Date.now() });

    // Load recent messages from DB for context
    const recentMessages = await getRecentMessages(sessionId, 20);
    const contextMessages: any[] = recentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Auto-rename session from first user message
    if (session.messageCount <= 1) {
      const autoName = message.slice(0, 30) + (message.length > 30 ? "..." : "");
      await renameSession(sessionId, autoName);
    }

    const agent = await getAgent();
    const encoder = new TextEncoder();

    // Fetch MCP toolsets
    const mcpToolsets = await getCachedMCPToolsets();
    const mcpToolCount = Object.keys(mcpToolsets).length;
    if (mcpToolCount > 0) {
      console.log(`[Chat] Injecting ${mcpToolCount} MCP tools into session ${sessionId}`);
    }

    const readable = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // Send session ID back to client (for new sessions)
        send({ type: "session", sessionId });
        await eventBus.emit("agent:start", { sessionId, message });

        try {
          const generateOptions: any = {};
          if (mcpToolCount > 0) {
            generateOptions.toolsets = mcpToolsets;
          }

          const result = await agent.generate(contextMessages, generateOptions);
          const resultObj = result as any;

          // Collect tool calls for persistence
          const allToolCalls: { toolName: string; args?: any; result?: any; status: string }[] = [];

          // Extract and emit tool calls from steps
          const steps = resultObj?.steps || [];
          for (const step of steps) {
            const toolCalls = step?.toolCalls || [];
            const toolResults = step?.toolResults || [];

            for (let i = 0; i < toolCalls.length; i++) {
              const tc = toolCalls[i];
              const tr = toolResults[i];
              const tcPayload = tc?.payload || tc;
              const trPayload = tr?.payload || tr;
              const rawName = tcPayload?.toolName || tcPayload?.name || tc?.toolName || "unknown";
              const toolName = resolveToolName(rawName);

              await eventBus.emit("tool:before_call", { toolName, args: tcPayload?.args || {} });
              send({ type: "tool-call", toolName, args: tcPayload?.args || {} });

              const toolResult = trPayload?.result || null;
              if (tr) {
                send({ type: "tool-result", toolName, result: toolResult });
                await eventBus.emit("tool:after_call", { toolName, result: toolResult });
              }

              allToolCalls.push({
                toolName,
                args: tcPayload?.args || {},
                result: toolResult,
                status: tr ? "done" : "error",
              });
            }
          }

          // Fallback: direct toolResults
          const directToolResults = resultObj?.toolResults || [];
          if (Array.isArray(directToolResults) && steps.length === 0) {
            for (const tr of directToolResults) {
              const toolName = tr?.toolName || "unknown";
              send({ type: "tool-call", toolName, args: tr?.args || {} });
              send({ type: "tool-result", toolName, result: tr?.result || null });
              allToolCalls.push({
                toolName, args: tr?.args || {},
                result: tr?.result || null, status: "done",
              });
            }
          }

          // Send text
          const text = result.text || "";
          if (text) {
            send({ type: "text", content: text });
          }

          // Persist assistant message to DB
          await addMessage(sessionId, {
            role: "assistant",
            content: text || "✅ Done.",
            toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
            timestamp: Date.now(),
          });

          await eventBus.emit("agent:end", { sessionId, toolCount: allToolCalls.length, textLength: text.length });
          await eventBus.emit("message:sent", { sessionId, content: text });

          send({ type: "done" });
          controller.close();
        } catch (err: any) {
          console.error("Agent error:", err.message);
          await eventBus.emit("agent:error", { sessionId, error: err.message });

          // Persist error message
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
