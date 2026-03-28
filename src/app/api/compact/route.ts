/**
 * Context Compaction API
 * 
 * GET /api/compact?sessionId=xxx — Check compaction stats for a session
 * POST /api/compact — Force compact a session's context
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, getRecentMessages } from "@/lib/session-manager";
import {
  compactIfNeeded,
  getCompactionStats,
  type ContextMessage,
} from "@/lib/context-compaction";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const rawMessages = await getRecentMessages(sessionId, 50);
  const messages: ContextMessage[] = rawMessages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  const stats = getCompactionStats(messages);
  return NextResponse.json({ sessionId, ...stats });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const rawMessages = await getRecentMessages(sessionId, 50);
    const messages: ContextMessage[] = rawMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const result = await compactIfNeeded(messages, sessionId);

    return NextResponse.json({
      success: true,
      compacted: result.compacted,
      originalCount: result.originalCount,
      newCount: result.newCount,
      savedTokens: result.savedTokens,
      factsFlushed: result.factsFlushed,
      hasSummary: !!result.summary,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
