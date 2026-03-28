/**
 * GET /api/v1/sessions/:id/messages — Get message history (paginated)
 * 
 * Query params:
 *   ?page=1&limit=50 — Pagination
 *   ?role=user — Filter by role (user, assistant)
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiNotFound, apiServerError, parsePagination } from "@/lib/api-response";
import { getSession, getMessages, getMessageCount } from "@/lib/session-manager";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "sessions-get");
  if (guard) return guard;

  try {
    const { id } = await params;
    const session = await getSession(id);
    if (!session) return apiNotFound("Session");

    const { searchParams } = new URL(req.url);
    const { page, limit, offset } = parsePagination(searchParams, { limit: 50 });
    const roleFilter = searchParams.get("role");

    let messages = await getMessages(id, limit, offset);

    // Optional role filter
    if (roleFilter && (roleFilter === "user" || roleFilter === "assistant")) {
      messages = messages.filter((m) => m.role === roleFilter);
    }

    const total = await getMessageCount(id);

    return apiOk(
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls || undefined,
        timestamp: m.timestamp,
      })),
      { page, limit, total, hasMore: offset + limit < total }
    );
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
