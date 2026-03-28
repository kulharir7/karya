/**
 * OAuth & Auth Management API
 * 
 * GET  /api/v1/auth — Get auth status for all providers
 * POST /api/v1/auth — Add/remove auth profile
 * 
 * POST actions:
 *   { action: "add-key", provider: "anthropic", apiKey: "sk-ant-..." }
 *   { action: "start-oauth", provider: "google", clientId: "..." }
 *   { action: "remove", profileId: "google:user@email.com" }
 *   { action: "set-active", provider: "google", profileId: "..." }
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiBadRequest, apiServerError } from "@/lib/api-response";
import {
  getAuthStatus,
  getAuthProfiles,
  addApiKeyProfile,
  removeAuthProfile,
  setActiveProfile,
  listProfiles,
  generateAuthUrl,
  handleOAuthCallback,
  validateAnthropicToken,
  OAUTH_PROVIDERS,
  startCallbackServer,
  waitForCallback,
} from "@/lib/oauth-providers";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "read");
  if (guard) return guard;

  try {
    const status = getAuthStatus();
    const profiles = getAuthProfiles();
    const providers = Object.entries(OAUTH_PROVIDERS).map(([id, config]) => ({
      id,
      name: config.name,
      icon: config.icon,
      color: config.color,
      authMethod: config.authMethod,
      consoleUrl: config.consoleUrl,
      instructions: config.instructions,
      configured: status[id]?.configured || false,
      source: status[id]?.source || "none",
      activeProfile: profiles.activeProfile[id],
    }));

    return apiOk({
      providers,
      profiles: listProfiles(),
      activeProfiles: profiles.activeProfile,
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
    const { action, provider, apiKey, profileId, clientId, clientSecret } = body;

    switch (action) {
      // ─────────────────────────────────────────────
      // ADD API KEY
      // ─────────────────────────────────────────────
      case "add-key": {
        if (!provider || !apiKey) {
          return apiBadRequest("provider and apiKey required");
        }

        // Validate Anthropic tokens
        if (provider === "anthropic") {
          const error = validateAnthropicToken(apiKey);
          if (error) {
            return apiBadRequest(error);
          }
        }

        const profile = addApiKeyProfile(provider, apiKey.trim());
        
        return apiOk({
          success: true,
          profile,
          message: `${OAUTH_PROVIDERS[provider]?.name || provider} API key added`,
        });
      }

      // ─────────────────────────────────────────────
      // START OAUTH FLOW
      // ─────────────────────────────────────────────
      case "start-oauth": {
        if (!provider) {
          return apiBadRequest("provider required");
        }

        const config = OAUTH_PROVIDERS[provider];
        if (!config || config.authMethod !== "oauth") {
          return apiBadRequest(`${provider} does not support OAuth`);
        }

        // For Google, clientId is optional (uses Gemini CLI credentials)
        const effectiveClientId = clientId || process.env.GOOGLE_OAUTH_CLIENT_ID || "";
        
        if (!effectiveClientId) {
          return apiBadRequest("clientId required for OAuth (or set GOOGLE_OAUTH_CLIENT_ID env)");
        }

        const authData = generateAuthUrl(provider, effectiveClientId);
        if (!authData) {
          return apiBadRequest(`Failed to generate OAuth URL for ${provider}`);
        }

        // Start callback server
        await startCallbackServer(18765);

        return apiOk({
          success: true,
          authUrl: authData.url,
          state: authData.state,
          message: `Open the URL to authorize with ${config.name}`,
        });
      }

      // ─────────────────────────────────────────────
      // COMPLETE OAUTH (handle callback)
      // ─────────────────────────────────────────────
      case "complete-oauth": {
        const { code, state } = body;
        
        if (!code || !state) {
          return apiBadRequest("code and state required");
        }

        const effectiveClientId = clientId || process.env.GOOGLE_OAUTH_CLIENT_ID || "";
        const effectiveClientSecret = clientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";

        const result = await handleOAuthCallback(code, state, effectiveClientId, effectiveClientSecret);
        
        if (!result.success) {
          return apiBadRequest(result.error);
        }

        return apiOk({
          success: true,
          profile: result.profile,
          message: `Logged in as ${result.profile.email || "user"}`,
        });
      }

      // ─────────────────────────────────────────────
      // WAIT FOR OAUTH CALLBACK (polling endpoint)
      // ─────────────────────────────────────────────
      case "wait-oauth": {
        const timeoutMs = body.timeoutMs || 60000;
        
        const result = await waitForCallback(timeoutMs);
        
        if (result.error) {
          return apiBadRequest(result.error);
        }

        if (!result.code || !result.state) {
          return apiBadRequest("No OAuth code received");
        }

        // Auto-complete the OAuth flow
        const effectiveClientId = clientId || process.env.GOOGLE_OAUTH_CLIENT_ID || "";
        const effectiveClientSecret = clientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";

        const completeResult = await handleOAuthCallback(
          result.code,
          result.state,
          effectiveClientId,
          effectiveClientSecret
        );

        if (!completeResult.success) {
          return apiBadRequest(completeResult.error);
        }

        return apiOk({
          success: true,
          profile: completeResult.profile,
          message: `Logged in as ${completeResult.profile.email || "user"}`,
        });
      }

      // ─────────────────────────────────────────────
      // REMOVE PROFILE
      // ─────────────────────────────────────────────
      case "remove": {
        if (!profileId) {
          return apiBadRequest("profileId required");
        }

        removeAuthProfile(profileId);
        
        return apiOk({
          success: true,
          message: `Profile ${profileId} removed`,
        });
      }

      // ─────────────────────────────────────────────
      // SET ACTIVE PROFILE
      // ─────────────────────────────────────────────
      case "set-active": {
        if (!provider || !profileId) {
          return apiBadRequest("provider and profileId required");
        }

        setActiveProfile(provider, profileId);
        
        return apiOk({
          success: true,
          message: `Active profile set to ${profileId}`,
        });
      }

      default:
        return apiBadRequest(`Unknown action: ${action}. Use: add-key, start-oauth, complete-oauth, remove, set-active`);
    }
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
