/**
 * POST /api/v1/chat — Send a message and receive SSE streaming response
 * 
 * Body:
 * {
 *   "message": "hello",
 *   "sessionId": "optional-session-id",
 *   "images": [{ "base64": "...", "mimeType": "image/png" }],
 *   "stream": true  // default true, false returns full response as JSON
 * }
 * 
 * Response (stream=true): SSE stream with text-delta, tool-call, tool-result, done
 * Response (stream=false): { ok: true, data: { text, toolCalls, sessionId, durationMs } }
 */

import { NextRequest } from "next/server";
import { apiGuard, corsHeaders, handleCORS } from "@/lib/api-middleware";
import { processChat, type ChatRequest, type ChatEvents } from "@/lib/chat-processor";
import { apiError, apiOk } from "@/lib/api-response";

export async function OPTIONS() {
  return handleCORS();
}

export async function POST(req: NextRequest) {
  // Auth + rate limit
  const guard = apiGuard(req, "chat");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { message, sessionId, images, stream = true } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return apiError("VALIDATION", "message is required and must be a non-empty string", 400);
    }

    const chatReq: ChatRequest = {
      message: message.trim(),
      sessionId,
      images,
      channel: "api",
    };

    // ---- Non-streaming mode ----
    if (!stream) {
      const result = await processChat(chatReq);

      if (!result.text && result.toolCalls.length === 0) {
        return apiError("AGENT_ERROR", "No response from AI", 502);
      }

      return apiOk({
        sessionId: result.sessionId,
        text: result.text,
        toolCalls: result.toolCalls,
        durationMs: result.durationMs,
        tokenEstimate: result.tokenEstimate,
      });
    }

    // ---- Streaming mode (SSE) ----
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        const events: ChatEvents = {
          onSession: (sid) => send({ type: "session", sessionId: sid }),
          onTextDelta: (delta) => send({ type: "text-delta", content: delta }),
          onToolCall: (toolName, args) => send({ type: "tool-call", toolName, args }),
          onToolApproval: (toolName, args, toolCallId) => send({ type: "tool-approval", toolName, args, toolCallId }),
          onToolResult: (toolName, result) => send({ type: "tool-result", toolName, result }),
          onDone: (result) => {
            send({
              type: "done",
              sessionId: result.sessionId,
              durationMs: result.durationMs,
              tokenEstimate: result.tokenEstimate,
              toolCount: result.toolCalls.length,
            });
            controller.close();
          },
          onError: (error) => {
            send({ type: "error", content: error });
            send({ type: "done" });
            controller.close();
          },
        };

        await processChat(chatReq, events);
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...corsHeaders(),
      },
    });
  } catch (err: any) {
    console.error("[v1/chat] Error:", err.message);
    return apiError("SERVER_ERROR", err.message || "Internal server error", 500);
  }
}
