import { NextRequest } from "next/server";
import {
  listSessions,
  getSession,
  createSession,
  renameSession,
  deleteSession,
  getMessages,
  clearMessages,
  ensureDefaultSession,
} from "@/lib/session-manager";

export const dynamic = "force-dynamic";

/**
 * GET /api/sessions — List all sessions or get a specific session's messages
 * 
 * Query params:
 *   ?id=<sessionId> — get messages for a session
 *   ?limit=<number> — max messages to return (default 100)
 *   (no params) — list all active sessions
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("id");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100");

  if (sessionId) {
    const session = await getSession(sessionId);
    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }
    const messages = await getMessages(sessionId, limit);
    return Response.json({ session, messages });
  }

  // Ensure default session exists
  await ensureDefaultSession();
  const sessions = await listSessions();
  return Response.json({ sessions });
}

/**
 * POST /api/sessions — Create, rename, delete, clear sessions
 * 
 * Body:
 *   { action: "create", name?: string }
 *   { action: "rename", id: string, name: string }
 *   { action: "delete", id: string }
 *   { action: "clear", id: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const session = await createSession(body.name);
    return Response.json({ success: true, session });
  }

  if (action === "rename") {
    if (!body.id || !body.name) {
      return Response.json({ error: "id and name required" }, { status: 400 });
    }
    await renameSession(body.id, body.name);
    return Response.json({ success: true });
  }

  if (action === "delete") {
    if (!body.id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }
    await deleteSession(body.id);
    return Response.json({ success: true });
  }

  if (action === "clear") {
    if (!body.id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }
    await clearMessages(body.id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
