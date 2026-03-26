import { NextRequest, NextResponse } from "next/server";
import "dotenv/config";

// Dynamic import to avoid issues with Mastra in edge
async function getAgent() {
  const { mastra } = await import("@/mastra");
  return mastra.getAgent("karya");
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const agent = await getAgent();

    // Build messages array
    const messages = [
      ...history.slice(-10), // Keep last 10 messages for context
      { role: "user" as const, content: message },
    ];

    const result = await agent.generate(messages);

    // Extract tool call info
    const toolCalls =
      result.toolResults?.map((t: any) => ({
        name: t.toolName,
        input: t.args,
        output: t.result,
      })) || [];

    return NextResponse.json({
      text: result.text,
      toolCalls,
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
        text: `❌ Error: ${error.message || "Something went wrong"}`,
        toolCalls: [],
      },
      { status: 500 }
    );
  }
}
