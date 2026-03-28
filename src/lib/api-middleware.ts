/**
 * API Middleware — Combines auth + rate limiting for v1 routes
 * 
 * Usage in any route:
 *   const guard = apiGuard(req, "chat");
 *   if (guard) return guard;  // Returns error response if blocked
 *   // ... proceed with handler
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, type TokenScope } from "./api-auth";
import { rateLimiter, RATE_LIMITS, getClientIP, rateLimitHeaders, type RateLimitConfig } from "./rate-limiter";

// ============================================
// ROUTE → SCOPE MAPPING
// ============================================

const SCOPE_MAP: Record<string, TokenScope> = {
  // Read-only
  "sessions-list": "read",
  "sessions-get": "read",
  "tools-list": "read",
  "agents-list": "read",
  "memory-search": "read",
  "status": "read",
  "health": "read",
  "mcp-list": "read",
  "tasks-list": "read",
  "workflows-list": "read",
  "plugins-list": "read",

  // Write operations
  "chat": "chat",
  "sessions-create": "write",
  "sessions-delete": "write",
  "sessions-rename": "write",
  "sessions-clear": "write",
  "memory-write": "write",
  "tasks-create": "write",
  "tasks-delete": "write",
  "workflows-run": "write",

  // Tool execution
  "tools-run": "tools",

  // Admin
  "tokens-create": "admin",
  "tokens-revoke": "admin",
  "settings": "admin",
  "bridges": "admin",
  "mcp-manage": "admin",
};

// Route → rate limit config
const RATE_MAP: Record<string, RateLimitConfig> = {
  chat: RATE_LIMITS.chat,
  "tools-run": RATE_LIMITS.tools,
  "tokens-create": RATE_LIMITS.tokenGen,
  default: RATE_LIMITS.general,
};

// ============================================
// MAIN GUARD
// ============================================

/**
 * Combined auth + rate limit guard.
 * 
 * Returns null if the request is allowed to proceed.
 * Returns a Response if the request should be blocked (401, 403, 429).
 * 
 * @param req - The incoming request
 * @param action - The action being performed (matches SCOPE_MAP keys)
 */
export function apiGuard(
  req: NextRequest,
  action: string = "default"
): NextResponse | null {
  const url = new URL(req.url);
  const headers = req.headers;

  // ---- 1. Authentication ----
  const requiredScope = SCOPE_MAP[action] || "read";
  const auth = authenticateRequest(headers, url, requiredScope);

  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: auth.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED", message: auth.error },
        timestamp: new Date().toISOString(),
      },
      { status: auth.status || 401 }
    );
  }

  // ---- 2. Rate limiting ----
  const clientIP = getClientIP(headers);
  const rateConfig = RATE_MAP[action] || RATE_MAP.default;
  const rateKey = `${action}:${clientIP}`;
  const rateResult = rateLimiter.check(rateKey, rateConfig);

  if (!rateResult.allowed) {
    const retryAfterSec = Math.ceil(rateResult.retryAfterMs / 1000);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: `Rate limit exceeded. Try again in ${retryAfterSec} seconds.`,
          retryAfterMs: rateResult.retryAfterMs,
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(rateResult),
          "Content-Type": "application/json",
        },
      }
    );
  }

  // ---- 3. All clear ----
  return null;
}

/**
 * CORS headers for v1 API routes.
 * Allows cross-origin requests with auth headers.
 */
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 */
export function handleCORS(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
