/**
 * GET  /api/v1/sessions — List all active sessions
 * POST /api/v1/sessions — Create a new session
 * 
 * Query params:
 *   ?page=1&limit=20 — Pagination
 *   ?status=active — Filter by status (active, archived, deleted)
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiCreated, apiBadRequest, apiServerError, parsePagination } from "@/lib/api-response";
import { listSessions, createSession } from "@/lib/session-manager";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "sessions-list");
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const { page, limit } = parsePagination(searchParams);

    const allSessions = await listSessions();
    const total = allSessions.length;
    const start = (page - 1) * limit;
    const paginated = allSessions.slice(start, start + limit);

    return apiOk(
      paginated.map((s) => ({
        id: s.id,
        name: s.name,
        messageCount: s.messageCount,
        tokenEstimate: s.tokenEstimate,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      { page, limit, total, hasMore: start + limit < total }
    );
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "sessions-create");
  if (guard) return guard;

  try {
    const body = await req.json().catch(() => ({}));
    const { name } = body as { name?: string };

    const session = await createSession(name || "New Chat");

    return apiCreated({
      id: session.id,
      name: session.name,
      messageCount: 0,
      tokenEstimate: 0,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
