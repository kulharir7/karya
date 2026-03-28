/**
 * GET  /api/v1/self-improve — Get quality stats, lessons count, trend
 * POST /api/v1/self-improve — Enable/disable self-review
 * 
 * POST body:
 *   { "action": "enable" }    — Turn on self-review
 *   { "action": "disable" }   — Turn off self-review
 *   { "action": "lessons", "query": "file operations" } — Search lessons
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiBadRequest, apiServerError } from "@/lib/api-response";
import {
  getQualityStats,
  getRelevantLessons,
  setSelfImproveEnabled,
  isSelfImproveEnabled,
} from "@/lib/self-improving";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "status");
  if (guard) return guard;

  try {
    const stats = getQualityStats();
    return apiOk({
      enabled: isSelfImproveEnabled(),
      ...stats,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "write");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { action, query } = body;

    if (action === "enable") {
      setSelfImproveEnabled(true);
      return apiOk({ enabled: true });
    }

    if (action === "disable") {
      setSelfImproveEnabled(false);
      return apiOk({ enabled: false });
    }

    if (action === "lessons" && query) {
      const lessons = getRelevantLessons(query, 5);
      return apiOk({ query, lessons: lessons || "No relevant lessons found." });
    }

    return apiBadRequest("action must be: enable, disable, lessons");
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
