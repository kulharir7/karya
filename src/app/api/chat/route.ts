import { NextRequest } from "next/server";
import "dotenv/config";
import { getMCPToolsets } from "@/mastra/mcp/client";

// Cache MCP tools for 60 seconds to avoid re-fetching on every message
let mcpToolsCache: { tools: Record<string, any>; timestamp: number } = { tools: {}, timestamp: 0 };
const MCP_CACHE_TTL = 60_000;

async function getAgent() {
  const { mastra } = await import("@/mastra");
  const agent = mastra.getAgent("karya");
  return agent;
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
    return mcpToolsCache.tools; // Return stale cache on error
  }
}

// Map Mastra variable names → tool IDs
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

// Reverse map for MCP: tool ID → variable name
const TOOL_ID_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TOOL_NAME_MAP).map(([k, v]) => [v, k])
);

function resolveToolName(raw: string): string {
  return TOOL_NAME_MAP[raw] || raw;
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const agent = await getAgent();
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Fetch MCP toolsets and merge with agent's built-in tools
          const mcpTools = await getCachedMCPToolsets();
          const mcpToolCount = Object.keys(mcpTools).length;
          if (mcpToolCount > 0) {
            console.log(`[Chat] Injecting ${mcpToolCount} MCP tools`);
          }

          const messages = [
            ...history.slice(-10),
            { role: "user" as const, content: message },
          ];

          // Generate with merged tools (built-in + MCP)
          const generateOptions: any = {};
          if (mcpToolCount > 0) {
            generateOptions.toolsets = mcpTools;
          }

          const result = await agent.generate(messages, generateOptions);
          const resultObj = result as any;

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

              send({
                type: "tool-call",
                toolName,
                args: tcPayload?.args || {},
              });

              if (tr) {
                send({
                  type: "tool-result",
                  toolName,
                  result: trPayload?.result || null,
                });
              }
            }
          }

          // Fallback: direct toolResults
          const directToolResults = resultObj?.toolResults || [];
          if (Array.isArray(directToolResults) && steps.length === 0) {
            for (const tr of directToolResults) {
              send({
                type: "tool-call",
                toolName: tr?.toolName || "unknown",
                args: tr?.args || {},
              });
              send({
                type: "tool-result",
                toolName: tr?.toolName || "unknown",
                result: tr?.result || null,
              });
            }
          }

          // Send text
          if (result.text) {
            send({ type: "text", content: result.text });
          }

          send({ type: "done" });
          controller.close();
        } catch (err: any) {
          console.error("Agent error:", err.message);
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
