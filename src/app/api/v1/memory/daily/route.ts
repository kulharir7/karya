/**
 * GET  /api/v1/memory/daily — Read today's daily log
 * POST /api/v1/memory/daily — Add entry to today's daily log
 * 
 * Query params:
 *   ?date=2026-03-28 — Read a specific date's log
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiBadRequest, apiServerError } from "@/lib/api-response";
import {
  readWorkspaceFile,
  logToDaily,
  initWorkspace,
} from "@/lib/memory-engine";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "memory-search");
  if (guard) return guard;

  try {
    initWorkspace();
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");

    const date = dateStr || new Date().toISOString().split("T")[0];
    const fileName = `memory/${date}.md`;

    let content: string | null = null;
    let exists = false;
    try {
      content = readWorkspaceFile(fileName);
      exists = true;
    } catch {
      exists = false;
    }

    return apiOk({
      date,
      file: fileName,
      content: content || "",
      exists,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "memory-write");
  if (guard) return guard;

  try {
    initWorkspace();
    const body = await req.json();
    const { entry } = body;

    if (!entry || typeof entry !== "string") {
      return apiBadRequest("entry is required (text to log)");
    }

    logToDaily(entry);
    return apiOk({ logged: true, entry, date: new Date().toISOString().split("T")[0] });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
