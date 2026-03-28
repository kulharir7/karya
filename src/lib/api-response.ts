/**
 * API Response Helpers — Consistent response format for all v1 endpoints
 * 
 * Standard format:
 * {
 *   "ok": true,
 *   "data": { ... },
 *   "meta": { "page": 1, "limit": 20, "total": 45, "hasMore": true },
 *   "timestamp": "2026-03-28T10:00:00Z"
 * }
 * 
 * Error format:
 * {
 *   "ok": false,
 *   "error": { "code": "NOT_FOUND", "message": "Session not found" },
 *   "timestamp": "2026-03-28T10:00:00Z"
 * }
 */

import { NextResponse } from "next/server";

// ============================================
// TYPES
// ============================================

export interface APIMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
  cursor?: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
}

// ============================================
// SUCCESS RESPONSES
// ============================================

/**
 * Standard success response.
 */
export function apiOk(data: any, meta?: APIMeta, status: number = 200): NextResponse {
  const body: any = {
    ok: true,
    data,
    timestamp: new Date().toISOString(),
  };

  if (meta && Object.keys(meta).length > 0) {
    body.meta = meta;
  }

  return NextResponse.json(body, { status });
}

/**
 * Success with pagination metadata.
 */
export function apiPaginated(
  items: any[],
  total: number,
  page: number,
  limit: number
): NextResponse {
  return apiOk(items, {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  });
}

/**
 * Success with just a message (no data payload).
 */
export function apiMessage(message: string, status: number = 200): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      message,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * 201 Created response.
 */
export function apiCreated(data: any): NextResponse {
  return apiOk(data, undefined, 201);
}

/**
 * 204 No Content (for DELETE operations).
 */
export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ============================================
// ERROR RESPONSES
// ============================================

/**
 * Standard error response.
 */
export function apiError(
  code: string,
  message: string,
  status: number = 400,
  details?: any
): NextResponse {
  const error: APIError = { code, message };
  if (details) error.details = details;

  return NextResponse.json(
    {
      ok: false,
      error,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/** 400 Bad Request */
export function apiBadRequest(message: string = "Bad request", details?: any): NextResponse {
  return apiError("BAD_REQUEST", message, 400, details);
}

/** 401 Unauthorized */
export function apiUnauthorized(message: string = "Authentication required"): NextResponse {
  return apiError("UNAUTHORIZED", message, 401);
}

/** 403 Forbidden */
export function apiForbidden(message: string = "Access denied"): NextResponse {
  return apiError("FORBIDDEN", message, 403);
}

/** 404 Not Found */
export function apiNotFound(resource: string = "Resource"): NextResponse {
  return apiError("NOT_FOUND", `${resource} not found`, 404);
}

/** 409 Conflict */
export function apiConflict(message: string): NextResponse {
  return apiError("CONFLICT", message, 409);
}

/** 429 Rate Limited */
export function apiRateLimited(retryAfterMs: number): NextResponse {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: `Rate limit exceeded. Try again in ${retryAfterSec} seconds.`,
        retryAfterMs,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: 429,
      headers: { "Retry-After": retryAfterSec.toString() },
    }
  );
}

/** 500 Internal Server Error */
export function apiServerError(message: string = "Internal server error", details?: any): NextResponse {
  return apiError("SERVER_ERROR", message, 500, details);
}

// ============================================
// PARSING HELPERS
// ============================================

/**
 * Parse pagination params from URL search params.
 * Defaults: page=1, limit=20, maxLimit=100
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {}
): { page: number; limit: number; offset: number } {
  const { page: defaultPage = 1, limit: defaultLimit = 20, maxLimit = 100 } = defaults;

  let page = parseInt(searchParams.get("page") || `${defaultPage}`, 10);
  let limit = parseInt(searchParams.get("limit") || `${defaultLimit}`, 10);

  // Sanitize
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

/**
 * Parse a cursor-based pagination param.
 */
export function parseCursor(
  searchParams: URLSearchParams
): { cursor: string | null; limit: number } {
  const cursor = searchParams.get("cursor") || null;
  let limit = parseInt(searchParams.get("limit") || "20", 10);
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;
  return { cursor, limit };
}
