import { NextRequest } from "next/server";
import "dotenv/config";

async function getAgent() {
  const { mastra } = await import("@/mastra");
  return mastra.getAgent("karya");
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
};

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
          // Use generate (more reliable for tool calls) and send result as stream
          const messages = [
            ...history.slice(-10),
            { role: "user" as const, content: message },
          ];

          const result = await agent.generate(messages);

          const resultObj = result as any;
          console.log("Result keys:", Object.keys(resultObj));
          if (resultObj.steps?.length > 0) {
            console.log("Step keys:", Object.keys(resultObj.steps[0]));
            const s = resultObj.steps[0];
            if (s.toolCalls?.length > 0) console.log("ToolCall sample:", JSON.stringify(s.toolCalls[0]).slice(0, 200));
            if (s.toolResults?.length > 0) console.log("ToolResult sample:", JSON.stringify(s.toolResults[0]).slice(0, 200));
          }
          
          // Try multiple paths to find tool calls
          // Path 1: result.steps[].toolCalls / toolResults
          const steps = resultObj?.steps || [];
          for (const step of steps) {
            const toolCalls = step?.toolCalls || [];
            const toolResults = step?.toolResults || [];
            
            for (let i = 0; i < toolCalls.length; i++) {
              const tc = toolCalls[i];
              const tr = toolResults[i];
              
              // Mastra wraps in .payload
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
          
          // Path 2: result.toolResults directly
          const directToolResults = resultObj?.toolResults || [];
          if (Array.isArray(directToolResults)) {
            for (const tr of directToolResults) {
              // Only send if not already sent via steps
              if (steps.length === 0) {
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
