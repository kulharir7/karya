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

    const messages = [
      ...history.slice(-10),
      { role: "user" as const, content: message },
    ];

    // Try streaming first, fallback to generate
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const result = await agent.stream(messages);

          // Stream text chunks
          for await (const chunk of result.textStream) {
            if (chunk) {
              const data = JSON.stringify({ type: "text", content: chunk });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // After stream completes, get full result for tool info
          const fullResult = await result;
          const toolResults = (fullResult as any)?.toolResults || [];
          
          if (toolResults.length > 0) {
            const toolCalls = toolResults.map((t: any) => ({
              name: t.toolName || t.name || "unknown",
              input: t.args || t.input || {},
              output: t.result || t.output || null,
            }));
            const toolData = JSON.stringify({ type: "tools", toolCalls });
            controller.enqueue(encoder.encode(`data: ${toolData}\n\n`));
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
          controller.close();
        } catch (streamErr: any) {
          console.error("Stream error, falling back to generate:", streamErr.message);

          // Fallback to non-streaming generate
          try {
            const result = await agent.generate(messages);
            const text = result.text || "";
            
            if (text) {
              const data = JSON.stringify({ type: "text", content: text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            const toolResults = (result as any)?.toolResults || [];
            if (toolResults.length > 0) {
              const toolCalls = toolResults.map((t: any) => ({
                name: t.toolName || "unknown",
                input: t.args || {},
                output: t.result || null,
              }));
              const toolData = JSON.stringify({ type: "tools", toolCalls });
              controller.enqueue(encoder.encode(`data: ${toolData}\n\n`));
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
            );
            controller.close();
          } catch (genErr: any) {
            const errData = JSON.stringify({
              type: "error",
              content: genErr.message || "Agent error",
            });
            controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
            );
            controller.close();
          }
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
