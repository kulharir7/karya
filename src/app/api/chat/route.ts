/**
 * POST /api/chat — Original SSE chat endpoint (backward compatible)
 * 
 * Now uses the shared ChatProcessor instead of inline logic.
 * The v1 API also uses the same processor, ensuring consistency.
 */

import { NextRequest } from "next/server";
import { processChat, type ChatRequest, type ChatEvents, type ImageAttachment } from "@/lib/chat-processor";

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, images } = await req.json() as {
      message: string;
      sessionId?: string;
      images?: ImageAttachment[];
    };

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const chatReq: ChatRequest = {
      message,
      sessionId,
      images,
      channel: "web",
    };

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
          onDone: () => {
            send({ type: "done" });
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
