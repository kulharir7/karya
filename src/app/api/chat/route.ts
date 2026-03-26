import { NextRequest } from "next/server";
import "dotenv/config";

async function getAgent() {
  const { mastra } = await import("@/mastra");
  return mastra.getAgent("karya");
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
          // Try streaming first
          try {
            const result = await agent.stream(message);

            // Stream text
            for await (const chunk of result.textStream) {
              if (chunk) {
                send({ type: "text", content: chunk });
              }
            }

            // After text stream, get tool results from full result
            const fullResult = await result;
            const toolResults = (fullResult as any)?.toolResults || [];
            for (const t of toolResults) {
              send({
                type: "tool-call",
                toolName: t.toolName || "unknown",
                args: t.args || {},
              });
              send({
                type: "tool-result",
                toolName: t.toolName || "unknown",
                result: t.result || null,
              });
            }
          } catch (streamErr: any) {
            console.log("Stream fallback:", streamErr.message);

            // Fallback to generate
            const messages = [
              ...history.slice(-10),
              { role: "user" as const, content: message },
            ];
            const result = await agent.generate(messages);

            // Send tool results
            const trs = (result as any)?.toolResults || [];
            for (const t of trs) {
              send({
                type: "tool-call",
                toolName: t.toolName || "unknown",
                args: t.args || {},
              });
              send({
                type: "tool-result",
                toolName: t.toolName || "unknown",
                result: t.result || null,
              });
            }

            // Send text
            if (result.text) {
              send({ type: "text", content: result.text });
            }
          }

          send({ type: "done" });
          controller.close();
        } catch (err: any) {
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
