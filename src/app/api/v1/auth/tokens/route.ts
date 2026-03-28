/**
 * GET  /api/v1/auth/tokens — List all API tokens (masked)
 * POST /api/v1/auth/tokens — Create or revoke a token
 * 
 * Body for POST:
 *   Create: { "action": "create", "name": "CLI", "scopes": ["*"], "expiresInDays": 0 }
 *   Revoke: { "action": "revoke", "token": "karya_xxx" or "CLI" (name) }
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiCreated, apiBadRequest, apiServerError } from "@/lib/api-response";
import {
  generateToken,
  revokeToken,
  listTokens,
  hasAnyTokens,
  type TokenScope,
} from "@/lib/api-auth";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  // Token list: admin only IF tokens exist, otherwise open (first-time setup)
  if (hasAnyTokens()) {
    const guard = apiGuard(req, "tokens-create");
    if (guard) return guard;
  }

  try {
    const tokens = listTokens();
    return apiOk({
      tokens,
      count: tokens.length,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  // First token creation is open (bootstrap), subsequent ones need admin
  if (hasAnyTokens()) {
    const guard = apiGuard(req, "tokens-create");
    if (guard) return guard;
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { name, scopes = ["*"], expiresInDays = 0 } = body;

      if (!name || typeof name !== "string") {
        return apiBadRequest("name is required for the token");
      }

      const validScopes: TokenScope[] = ["chat", "read", "write", "tools", "admin", "*"];
      const requestedScopes = (scopes as string[]).filter((s) => validScopes.includes(s as TokenScope));
      if (requestedScopes.length === 0) {
        return apiBadRequest(`Invalid scopes. Valid: ${validScopes.join(", ")}`);
      }

      const token = generateToken(name, requestedScopes as TokenScope[], expiresInDays);

      return apiCreated({
        token: token.token, // Full token shown ONCE at creation
        name: token.name,
        scopes: token.scopes,
        expiresAt: token.expiresAt || null,
        message: "⚠️ Save this token now — it won't be shown again in full.",
      });
    }

    if (action === "revoke") {
      const { token: tokenOrName } = body;

      if (!tokenOrName) {
        return apiBadRequest("token (full string or name) is required");
      }

      const success = revokeToken(tokenOrName);
      return apiOk({ revoked: success, identifier: tokenOrName });
    }

    return apiBadRequest("action must be 'create' or 'revoke'");
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
