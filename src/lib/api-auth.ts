/**
 * API Authentication — Token-based auth for external clients
 * 
 * How it works:
 * - Web UI (same origin) → no auth needed
 * - CLI / REST / WebSocket / Bridges → Bearer token required
 * - Tokens stored in karya-api-tokens.json
 * - Each token has a name, creation date, and optional expiry
 * 
 * Header format:
 *   Authorization: Bearer karya_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 * 
 * Query param fallback:
 *   ?token=karya_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================
// TYPES
// ============================================

export interface APIToken {
  /** The actual token string: karya_xxxx */
  token: string;
  /** Human-readable name: "CLI", "Telegram Bridge", etc. */
  name: string;
  /** When the token was created */
  createdAt: number;
  /** Optional expiry timestamp (0 = never expires) */
  expiresAt: number;
  /** Last time this token was used */
  lastUsedAt: number;
  /** How many requests this token has made */
  requestCount: number;
  /** Which permissions this token has */
  scopes: TokenScope[];
}

export type TokenScope =
  | "chat"       // Can send chat messages
  | "read"       // Can read sessions, tools, status
  | "write"      // Can create/delete sessions, manage tasks
  | "tools"      // Can execute tools directly
  | "admin"      // Can manage tokens, settings, bridges
  | "*";         // All permissions

export interface TokenValidation {
  valid: boolean;
  token?: APIToken;
  error?: string;
}

// ============================================
// TOKEN STORAGE
// ============================================

const TOKEN_FILE = path.join(process.cwd(), "karya-api-tokens.json");

function loadTokens(): APIToken[] {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("[api-auth] Failed to load tokens:", err);
  }
  return [];
}

function saveTokens(tokens: APIToken[]): void {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf-8");
  } catch (err) {
    console.error("[api-auth] Failed to save tokens:", err);
  }
}

// ============================================
// TOKEN OPERATIONS
// ============================================

/**
 * Generate a new API token.
 */
export function generateToken(
  name: string,
  scopes: TokenScope[] = ["*"],
  expiresInDays: number = 0
): APIToken {
  const tokenStr = `karya_${crypto.randomBytes(24).toString("hex")}`;
  const now = Date.now();

  const token: APIToken = {
    token: tokenStr,
    name,
    createdAt: now,
    expiresAt: expiresInDays > 0 ? now + expiresInDays * 86400000 : 0,
    lastUsedAt: 0,
    requestCount: 0,
    scopes,
  };

  const tokens = loadTokens();
  tokens.push(token);
  saveTokens(tokens);

  return token;
}

/**
 * Validate a token string.
 * Returns the token record if valid, or error info if not.
 */
export function validateToken(tokenStr: string): TokenValidation {
  if (!tokenStr) {
    return { valid: false, error: "No token provided" };
  }

  if (!tokenStr.startsWith("karya_")) {
    return { valid: false, error: "Invalid token format (must start with karya_)" };
  }

  const tokens = loadTokens();
  const token = tokens.find((t) => t.token === tokenStr);

  if (!token) {
    return { valid: false, error: "Token not found" };
  }

  // Check expiry
  if (token.expiresAt > 0 && Date.now() > token.expiresAt) {
    return { valid: false, error: "Token expired" };
  }

  // Update usage stats
  token.lastUsedAt = Date.now();
  token.requestCount++;
  saveTokens(tokens);

  return { valid: true, token };
}

/**
 * Check if a token has a specific scope.
 */
export function hasScope(token: APIToken, scope: TokenScope): boolean {
  return token.scopes.includes("*") || token.scopes.includes(scope);
}

/**
 * List all tokens (with masked values for security).
 */
export function listTokens(): Array<Omit<APIToken, "token"> & { tokenPreview: string }> {
  return loadTokens().map((t) => ({
    ...t,
    token: undefined as any,
    tokenPreview: t.token.slice(0, 10) + "***" + t.token.slice(-4),
  }));
}

/**
 * Revoke (delete) a token by its full string or preview.
 */
export function revokeToken(tokenOrPreview: string): boolean {
  const tokens = loadTokens();
  const idx = tokens.findIndex(
    (t) =>
      t.token === tokenOrPreview ||
      t.name === tokenOrPreview ||
      (t.token.slice(0, 10) + "***" + t.token.slice(-4)) === tokenOrPreview
  );

  if (idx === -1) return false;
  tokens.splice(idx, 1);
  saveTokens(tokens);
  return true;
}

/**
 * Check if any tokens exist. If none, API auth is disabled (open access).
 * This allows first-time setup without needing a token.
 */
export function hasAnyTokens(): boolean {
  return loadTokens().length > 0;
}

// ============================================
// REQUEST HELPERS
// ============================================

/**
 * Extract token from HTTP request headers or query params.
 * 
 * Checks in order:
 * 1. Authorization: Bearer karya_xxx
 * 2. ?token=karya_xxx
 * 3. X-API-Key: karya_xxx
 */
export function extractToken(headers: Headers, url?: URL): string | null {
  // 1. Authorization header
  const auth = headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }

  // 2. X-API-Key header
  const apiKey = headers.get("x-api-key");
  if (apiKey) return apiKey;

  // 3. Query param
  if (url) {
    const token = url.searchParams.get("token");
    if (token) return token;
  }

  return null;
}

/**
 * Check if a request is from the same origin (web UI).
 * Same-origin requests don't need auth.
 */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const referer = headers.get("referer");

  // Next.js API routes from same app have no origin but have referer
  if (!origin && !referer) {
    // Server-side call (internal) — allow
    return true;
  }

  // Check if origin matches our server
  const host = headers.get("host");
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      return originUrl.host === host;
    } catch {
      return false;
    }
  }

  // Referer from same host
  if (referer && host) {
    try {
      const refUrl = new URL(referer);
      return refUrl.host === host;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Full authentication check for an API request.
 * 
 * Rules:
 * - Same-origin (web UI) → always allowed
 * - No tokens exist yet → always allowed (first-time setup)
 * - External request → token required, scope checked
 */
export function authenticateRequest(
  headers: Headers,
  url?: URL,
  requiredScope: TokenScope = "read"
): { ok: boolean; token?: APIToken; error?: string; status?: number } {
  // Same-origin requests bypass auth
  if (isSameOrigin(headers)) {
    return { ok: true };
  }

  // No tokens configured → open access (first-time friendly)
  if (!hasAnyTokens()) {
    return { ok: true };
  }

  // Extract and validate token
  const tokenStr = extractToken(headers, url);
  if (!tokenStr) {
    return {
      ok: false,
      error: "Authentication required. Provide token via Authorization: Bearer <token>",
      status: 401,
    };
  }

  const validation = validateToken(tokenStr);
  if (!validation.valid) {
    return {
      ok: false,
      error: validation.error || "Invalid token",
      status: 401,
    };
  }

  // Check scope
  if (!hasScope(validation.token!, requiredScope)) {
    return {
      ok: false,
      error: `Token lacks required scope: ${requiredScope}`,
      status: 403,
    };
  }

  return { ok: true, token: validation.token };
}
