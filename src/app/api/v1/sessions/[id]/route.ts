/**
 * GET    /api/v1/sessions/:id — Get session details
 * PUT    /api/v1/sessions/:id — Rename session
 * DELETE /api/v1/sessions/:id — Delete session
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiNotFound, apiBadRequest, apiNoContent, apiServerError } from "@/lib/api-response";
import {
  getSession,
  renameSession,
  deleteSession,
  clearMessages,
  getMessageCount,
} from "@/lib/session-manager";

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

    return apiOk({
      id: session.id,
      name: session.name,
      messageCount: session.messageCount,
      tokenEstimate: session.tokenEstimate,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "sessions-rename");
  if (guard) return guard;

  try {
    const { id } = await params;
    const session = await getSession(id);
    if (!session) return apiNotFound("Session");

    const body = await req.json();
    const { name, action } = body;

    // Support "clear" action
    if (action === "clear") {
      await clearMessages(id);
      return apiOk({ id, action: "cleared", messageCount: 0 });
    }

    if (!name || typeof name !== "string") {
      return apiBadRequest("name is required");
    }

    await renameSession(id, name);
    return apiOk({ id, name });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "sessions-delete");
  if (guard) return guard;

  try {
    const { id } = await params;
    const session = await getSession(id);
    if (!session) return apiNotFound("Session");

    await deleteSession(id);
    return apiNoContent();
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
