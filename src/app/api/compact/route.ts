/**
 * Context Compaction API
 * 
 * POST /api/compact — Compact a session's messages
 * GET /api/compact?sessionId=xxx — Check if compaction needed
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, getMessages, clearMessages, addMessage } from "@/lib/session-manager";
import {
  smartCompact,
  getCompactionStats,
  extractFacts,
  type Message,
} from "@/lib/context-compaction";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId required" },
      { status: 400 }
    );
  }
  
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }
  
  const rawMessages = await getMessages(sessionId);
  const messages: Message[] = rawMessages.map((m: any) => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
  }));
  
  const stats = getCompactionStats(messages);
  
  return NextResponse.json({
    sessionId,
    ...stats,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, keepRecent, extractMemory } = body;
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId required" },
        { status: 400 }
      );
    }
    
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
    
    const rawMessages = await getMessages(sessionId);
    const messages: Message[] = rawMessages.map((m: any) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));
    
    // Compact
    const result = await smartCompact(messages, { keepRecent });
    
    // Extract facts for memory (optional)
    let facts: string[] = [];
    if (extractMemory) {
      facts = extractFacts(messages);
    }
    
    // Update session if compacted
    if (result.compacted) {
      // Clear old messages and add compacted ones
      await clearMessages(sessionId);
      for (const msg of result.messages) {
        await addMessage(sessionId, {
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
          timestamp: msg.timestamp || Date.now(),
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      compacted: result.compacted,
      originalCount: result.originalCount,
      newCount: result.newCount,
      savedChars: result.savedChars,
      summary: result.summary,
      facts: extractMemory ? facts : undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
