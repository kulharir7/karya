/**
 * OAuth Providers for Karya
 * 
 * Supports browser-based OAuth login for:
 * - Google (Gemini API via Google Cloud)
 * - OpenAI (API key or OAuth)
 * - Anthropic (Console setup-token)
 * 
 * Flow:
 * 1. User clicks "Login with [Provider]"
 * 2. Opens provider auth URL in browser
 * 3. User logs in and authorizes
 * 4. Callback captures code/token
 * 5. Exchange for access token
 * 6. Store in auth-profiles.json
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { createServer, IncomingMessage, ServerResponse } from "http";

// ============================================
// TYPES
// ============================================

export interface OAuthProfile {
  id: string;
  provider: string;
  email?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  createdAt: number;
  type: "oauth" | "api-key" | "setup-token";
}

export interface AuthProfileStore {
  version: number;
  profiles: Record<string, OAuthProfile>;
  activeProfile: Record<string, string>; // provider -> profileId
}

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  authUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scopes: string[];
}

export interface PkceChallenge {
  verifier: string;
  challenge: string;
}

// ============================================
// PATHS
// ============================================

const AUTH_STORE_PATH = path.join(process.cwd(), "auth-profiles.json");

// ============================================
// PROVIDER CONFIGS
// ============================================

export const OAUTH_PROVIDERS: Record<string, {
  name: string;
  icon: string;
  color: string;
  authMethod: "oauth" | "api-key" | "setup-token";
  instructions?: string;
  authUrl?: string;
  tokenUrl?: string;
  scopes?: string[];
  redirectUri?: string;
  envKeys?: string[];
  consoleUrl?: string;
}> = {
  anthropic: {
    name: "Anthropic (Claude)",
    icon: "🤖",
    color: "from-orange-500 to-amber-600",
    authMethod: "setup-token",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    instructions: `
1. Go to console.anthropic.com/settings/keys
2. Click "Create Key" 
3. Copy the key (starts with sk-ant-)
4. Paste it below
    `.trim(),
    envKeys: ["ANTHROPIC_API_KEY"],
  },
  
  openai: {
    name: "OpenAI (GPT)",
    icon: "🧠",
    color: "from-emerald-500 to-teal-600",
    authMethod: "api-key",
    consoleUrl: "https://platform.openai.com/api-keys",
    instructions: `
1. Go to platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with sk-)
4. Paste it below
    `.trim(),
    envKeys: ["OPENAI_API_KEY"],
  },
  
  google: {
    name: "Google (Gemini)",
    icon: "✨",
    color: "from-blue-500 to-indigo-600",
    authMethod: "oauth",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    redirectUri: "http://localhost:18765/oauth/callback",
    scopes: [
      "https://www.googleapis.com/auth/generative-language.retriever",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    consoleUrl: "https://aistudio.google.com/apikey",
    instructions: `
Option 1: API Key (Simple)
1. Go to aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy and paste below

Option 2: OAuth (Full Access)
1. Click "Login with Google" below
2. Authorize Karya to use Gemini API
3. Done! No key needed.
    `.trim(),
    envKeys: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
  },
  
  openrouter: {
    name: "OpenRouter",
    icon: "🌐",
    color: "from-purple-500 to-pink-600",
    authMethod: "api-key",
    consoleUrl: "https://openrouter.ai/keys",
    instructions: `
1. Go to openrouter.ai/keys
2. Click "Create Key"
3. Copy the key (starts with sk-or-)
4. Paste it below
    `.trim(),
    envKeys: ["OPENROUTER_API_KEY"],
  },
};

// ============================================
// AUTH STORE
// ============================================

function loadAuthStore(): AuthProfileStore {
  try {
    if (fs.existsSync(AUTH_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(AUTH_STORE_PATH, "utf-8"));
    }
  } catch {}
  return { version: 1, profiles: {}, activeProfile: {} };
}

function saveAuthStore(store: AuthProfileStore): void {
  fs.writeFileSync(AUTH_STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function getAuthProfiles(): AuthProfileStore {
  return loadAuthStore();
}

export function getActiveProfile(provider: string): OAuthProfile | null {
  const store = loadAuthStore();
  const profileId = store.activeProfile[provider];
  if (profileId && store.profiles[profileId]) {
    return store.profiles[profileId];
  }
  // Fallback: find any profile for this provider
  const profiles = Object.values(store.profiles).filter(p => p.provider === provider);
  return profiles[0] || null;
}

export function setActiveProfile(provider: string, profileId: string): void {
  const store = loadAuthStore();
  if (store.profiles[profileId]) {
    store.activeProfile[provider] = profileId;
    saveAuthStore(store);
  }
}

export function addAuthProfile(profile: OAuthProfile): void {
  const store = loadAuthStore();
  store.profiles[profile.id] = profile;
  store.activeProfile[profile.provider] = profile.id;
  saveAuthStore(store);
}

export function removeAuthProfile(profileId: string): void {
  const store = loadAuthStore();
  const profile = store.profiles[profileId];
  if (profile) {
    delete store.profiles[profileId];
    if (store.activeProfile[profile.provider] === profileId) {
      delete store.activeProfile[profile.provider];
    }
    saveAuthStore(store);
  }
}

export function listProfiles(provider?: string): OAuthProfile[] {
  const store = loadAuthStore();
  const profiles = Object.values(store.profiles);
  if (provider) {
    return profiles.filter(p => p.provider === provider);
  }
  return profiles;
}

// ============================================
// PKCE (Proof Key for Code Exchange)
// ============================================

export function generatePkce(): PkceChallenge {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// ============================================
// OAUTH FLOW
// ============================================

// Pending OAuth states (in-memory, cleared on server restart)
const pendingOAuthStates = new Map<string, {
  provider: string;
  verifier: string;
  createdAt: number;
}>();

/**
 * Generate OAuth authorization URL
 */
export function generateAuthUrl(provider: string, clientId: string): {
  url: string;
  state: string;
  verifier: string;
} | null {
  const config = OAUTH_PROVIDERS[provider];
  if (!config || config.authMethod !== "oauth" || !config.authUrl) {
    return null;
  }

  const { verifier, challenge } = generatePkce();
  const state = crypto.randomBytes(16).toString("hex");
  
  // Store state for verification
  pendingOAuthStates.set(state, {
    provider,
    verifier,
    createdAt: Date.now(),
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: config.redirectUri!,
    response_type: "code",
    scope: config.scopes!.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });

  return {
    url: `${config.authUrl}?${params.toString()}`,
    state,
    verifier,
  };
}

/**
 * Handle OAuth callback and exchange code for tokens
 */
export async function handleOAuthCallback(
  code: string,
  state: string,
  clientId: string,
  clientSecret?: string
): Promise<{ success: true; profile: OAuthProfile } | { success: false; error: string }> {
  const pending = pendingOAuthStates.get(state);
  if (!pending) {
    return { success: false, error: "Invalid or expired OAuth state" };
  }

  // Clean up
  pendingOAuthStates.delete(state);

  const config = OAUTH_PROVIDERS[pending.provider];
  if (!config || !config.tokenUrl) {
    return { success: false, error: "Provider not configured for OAuth" };
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret || "",
        code,
        redirect_uri: config.redirectUri!,
        grant_type: "authorization_code",
        code_verifier: pending.verifier,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      return { success: false, error: `Token exchange failed: ${error}` };
    }

    const tokens = await tokenResponse.json();
    
    // Get user info (for Google)
    let email: string | undefined;
    if (pending.provider === "google") {
      try {
        const userInfoResponse = await fetch(
          "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          email = userInfo.email;
        }
      } catch {}
    }

    const profileId = `${pending.provider}:${email || "default"}`;
    const profile: OAuthProfile = {
      id: profileId,
      provider: pending.provider,
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
      createdAt: Date.now(),
      type: "oauth",
    };

    addAuthProfile(profile);

    return { success: true, profile };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Add API key as profile
 */
export function addApiKeyProfile(
  provider: string,
  apiKey: string,
  email?: string
): OAuthProfile {
  const profileId = `${provider}:${email || "api-key"}`;
  const profile: OAuthProfile = {
    id: profileId,
    provider,
    email,
    accessToken: apiKey,
    createdAt: Date.now(),
    type: "api-key",
  };
  
  addAuthProfile(profile);
  return profile;
}

/**
 * Validate Anthropic setup token format
 */
export function validateAnthropicToken(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return "Token is required";
  if (!trimmed.startsWith("sk-ant-")) return "Token should start with sk-ant-";
  if (trimmed.length < 40) return "Token looks too short";
  return null; // Valid
}

/**
 * Get API key for provider (from active profile or env)
 */
export function getApiKeyForProvider(provider: string): string | null {
  // Check active profile first
  const profile = getActiveProfile(provider);
  if (profile?.accessToken) {
    return profile.accessToken;
  }

  // Fallback to env vars
  const config = OAUTH_PROVIDERS[provider];
  if (config?.envKeys) {
    for (const key of config.envKeys) {
      const value = process.env[key]?.trim();
      if (value) return value;
    }
  }

  return null;
}

/**
 * Check if provider has valid auth
 */
export function hasAuthForProvider(provider: string): boolean {
  return !!getApiKeyForProvider(provider);
}

/**
 * Get auth status for all providers
 */
export function getAuthStatus(): Record<string, {
  configured: boolean;
  profile?: OAuthProfile;
  source: "profile" | "env" | "none";
}> {
  const status: Record<string, any> = {};
  
  for (const [provider, config] of Object.entries(OAUTH_PROVIDERS)) {
    const profile = getActiveProfile(provider);
    
    if (profile) {
      status[provider] = {
        configured: true,
        profile,
        source: "profile",
      };
    } else if (config.envKeys?.some(k => process.env[k]?.trim())) {
      status[provider] = {
        configured: true,
        source: "env",
      };
    } else {
      status[provider] = {
        configured: false,
        source: "none",
      };
    }
  }
  
  return status;
}

// ============================================
// LOCAL OAUTH CALLBACK SERVER
// ============================================

let callbackServer: ReturnType<typeof createServer> | null = null;
let pendingCallback: ((result: { code?: string; error?: string; state?: string }) => void) | null = null;

/**
 * Start local OAuth callback server
 */
export function startCallbackServer(port = 18765): Promise<void> {
  return new Promise((resolve, reject) => {
    if (callbackServer) {
      resolve();
      return;
    }

    callbackServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || "/", `http://localhost:${port}`);
      
      if (url.pathname === "/oauth/callback") {
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const state = url.searchParams.get("state");

        // Send success page
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Karya - Auth Complete</title>
            <style>
              body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; }
              .card { background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; text-align: center; backdrop-filter: blur(10px); }
              h1 { margin: 0 0 10px; font-size: 48px; }
              p { color: rgba(255,255,255,0.8); }
              .success { color: #4ade80; }
              .error { color: #f87171; }
            </style>
          </head>
          <body>
            <div class="card">
              ${error 
                ? `<h1>❌</h1><p class="error">Authentication failed: ${error}</p>` 
                : `<h1>✅</h1><p class="success">Authentication successful!</p><p>You can close this window.</p>`
              }
            </div>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
          </html>
        `);

        // Notify waiting caller
        if (pendingCallback) {
          pendingCallback({ code: code || undefined, error: error || undefined, state: state || undefined });
          pendingCallback = null;
        }
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    callbackServer.listen(port, () => {
      console.log(`[oauth] Callback server listening on port ${port}`);
      resolve();
    });

    callbackServer.on("error", reject);
  });
}

/**
 * Wait for OAuth callback
 */
export function waitForCallback(timeoutMs = 300000): Promise<{ code?: string; error?: string; state?: string }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingCallback = null;
      resolve({ error: "OAuth timeout - no callback received" });
    }, timeoutMs);

    pendingCallback = (result) => {
      clearTimeout(timeout);
      resolve(result);
    };
  });
}

/**
 * Stop callback server
 */
export function stopCallbackServer(): void {
  if (callbackServer) {
    callbackServer.close();
    callbackServer = null;
  }
}
