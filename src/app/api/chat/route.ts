import { NextRequest } from "next/server";
import "dotenv/config";

async function getAgent() {
  const { mastra } = await import("@/mastra");
  return mastra.getAgent("karya");
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [], threadId = "default" } = await req.json();

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
        try {
          // Try streaming
          let fullText = "";
          const toolCalls: any[] = [];

          try {
            const result = await agent.stream(message);

            for await (const chunk of result.textStream) {
              if (chunk) {
                fullText += chunk;
                const data = JSON.stringify({ type: "text", content: chunk });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }
          } catch (streamErr: any) {
            // Fallback to generate
            console.log("Stream fallback:", streamErr.message);

            const messages = [
              ...history.slice(-10),
              { role: "user" as const, content: message },
            ];

            const result = await agent.generate(messages);
            fullText = result.text || "";

            if (fullText) {
              const data = JSON.stringify({ type: "text", content: fullText });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            const trs = (result as any)?.toolResults || [];
            for (const t of trs) {
              toolCalls.push({
                name: t.toolName || "unknown",
                input: t.args || {},
                output: t.result || null,
              });
            }
          }

          // Send tool calls if any
          if (toolCalls.length > 0) {
            const toolData = JSON.stringify({ type: "tools", toolCalls });
            controller.enqueue(encoder.encode(`data: ${toolData}\n\n`));
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
          controller.close();
        } catch (err: any) {
          const errData = JSON.stringify({
            type: "error",
            content: err.message || "Agent error",
          });
          controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
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
