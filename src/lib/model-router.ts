/**
 * Model Router — Dynamic model resolution for Mastra agents
 * 
 * Phase A: Instead of manually creating provider instances,
 * we use Mastra's model string format: "provider/model-name"
 * 
 * For standard providers (anthropic, openai, google):
 *   Mastra auto-resolves from env vars (ANTHROPIC_API_KEY, etc.)
 *   Just use: "anthropic/claude-sonnet-4"
 * 
 * For custom providers (ollama-cloud):
 *   Register a MastraModelGateway, then use: "ollama-cloud/qwen3-coder:480b"
 * 
 * For dynamic switching:
 *   model: () => getModelString() — reads latest from config each call
 */

import * as fs from "fs";
import * as path from "path";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// ============================================
// CONFIG
// ============================================

const CONFIG_PATH = path.join(process.cwd(), "karya-config.json");
const AUTH_PROFILES_PATH = path.join(process.cwd(), "auth-profiles.json");

interface ModelConfig {
  provider: string;
  model: string;
  customProvider?: {
    name: string;
    baseURL: string;
    apiKey: string;
  };
}

function readConfig(): ModelConfig {
  // File config has priority (allows UI switching)
  let fileConfig: any = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {}

  // Env vars as fallback (initial setup)
  const envProvider = process.env.LLM_PROVIDER;
  const envModel = process.env.LLM_MODEL;
  const envBaseURL = process.env.LLM_BASE_URL;
  const envApiKey = process.env.LLM_API_KEY;

  // File config wins if it has provider set (means user has configured via UI)
  const provider = fileConfig.provider || envProvider || "anthropic";
  const model = fileConfig.model || envModel || "claude-sonnet-4-20250514";

  // For custom providers, merge file + env
  let customProvider = fileConfig.customProvider;
  if (!customProvider && envBaseURL) {
    customProvider = {
      name: envProvider || "custom",
      baseURL: envBaseURL,
      apiKey: envApiKey || "",
    };
  }

  return { provider, model, customProvider };
}

// ============================================
// STANDARD PROVIDERS (Mastra auto-resolves)
// ============================================

const MASTRA_NATIVE_PROVIDERS = new Set([
  "anthropic", "openai", "google", "openrouter",
  "xai", "deepseek", "mistral", "cohere", "groq",
]);

// ============================================
// AUTH PROFILES — Get API key from saved profiles
// ============================================

interface AuthProfile {
  id: string;
  provider: string;
  accessToken: string;
  type: string;
}

interface AuthStore {
  profiles: Record<string, AuthProfile>;
  activeProfile: Record<string, string>;
}

function getApiKeyFromProfiles(provider: string): string | null {
  try {
    if (!fs.existsSync(AUTH_PROFILES_PATH)) return null;
    
    const store: AuthStore = JSON.parse(fs.readFileSync(AUTH_PROFILES_PATH, "utf-8"));
    const activeProfileId = store.activeProfile[provider];
    
    if (activeProfileId && store.profiles[activeProfileId]) {
      return store.profiles[activeProfileId].accessToken;
    }
    
    // Fallback: find any profile for this provider
    const profile = Object.values(store.profiles).find(p => p.provider === provider);
    return profile?.accessToken || null;
  } catch {
    return null;
  }
}

/**
 * Get API key for a provider — checks profiles first, then env vars
 */
function getApiKeyForProvider(provider: string): string | null {
  // 1. Check auth-profiles.json first
  const profileKey = getApiKeyFromProfiles(provider);
  if (profileKey) return profileKey;
  
  // 2. Check karya-config.json apiKeys
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      if (config.apiKeys?.[provider]) {
        return config.apiKeys[provider];
      }
    }
  } catch {}
  
  // 3. Check environment variables
  const envVarMap: Record<string, string[]> = {
    anthropic: ["ANTHROPIC_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    google: ["GOOGLE_API_KEY", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
    openrouter: ["OPENROUTER_API_KEY"],
  };
  
  const envVars = envVarMap[provider] || [];
  for (const envVar of envVars) {
    const value = process.env[envVar]?.trim();
    if (value) return value;
  }
  
  return null;
}

// ============================================
// PROVIDER INSTANCES (with custom API keys)
// ============================================

let cachedAnthropicProvider: any = null;
let cachedAnthropicKey = "";

let cachedOpenAIProvider: any = null;
let cachedOpenAIKey = "";

let cachedGoogleProvider: any = null;
let cachedGoogleKey = "";

let cachedOpenRouterProvider: any = null;
let cachedOpenRouterKey = "";

function getAnthropicProvider(apiKey: string) {
  if (cachedAnthropicProvider && cachedAnthropicKey === apiKey) {
    return cachedAnthropicProvider;
  }
  cachedAnthropicProvider = createAnthropic({ apiKey });
  cachedAnthropicKey = apiKey;
  return cachedAnthropicProvider;
}

function getOpenAIProvider(apiKey: string) {
  if (cachedOpenAIProvider && cachedOpenAIKey === apiKey) {
    return cachedOpenAIProvider;
  }
  cachedOpenAIProvider = createOpenAI({ apiKey });
  cachedOpenAIKey = apiKey;
  return cachedOpenAIProvider;
}

function getGoogleProvider(apiKey: string) {
  if (cachedGoogleProvider && cachedGoogleKey === apiKey) {
    return cachedGoogleProvider;
  }
  cachedGoogleProvider = createGoogleGenerativeAI({ apiKey });
  cachedGoogleKey = apiKey;
  return cachedGoogleProvider;
}

function getOpenRouterProvider(apiKey: string) {
  if (cachedOpenRouterProvider && cachedOpenRouterKey === apiKey) {
    return cachedOpenRouterProvider;
  }
  cachedOpenRouterProvider = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
  cachedOpenRouterKey = apiKey;
  return cachedOpenRouterProvider;
}

// ============================================
// CUSTOM PROVIDER CACHE
// ============================================

let cachedCustomProvider: any = null;
let cachedCustomKey = "";

function getCustomProvider(baseURL: string, apiKey: string, name: string) {
  const key = `${baseURL}:${apiKey}`;
  if (cachedCustomProvider && cachedCustomKey === key) {
    return cachedCustomProvider;
  }

  // Ollama Cloud uses Bearer token auth, not OpenAI-style API key
  const isOllamaCloud = baseURL.includes("ollama.com");
  
  cachedCustomProvider = createOpenAICompatible({
    name,
    baseURL,
    apiKey: apiKey || "none",
    // Ollama Cloud needs Authorization: Bearer <token>
    headers: isOllamaCloud ? {
      "Authorization": `Bearer ${apiKey}`,
    } : undefined,
  });
  cachedCustomKey = key;
  return cachedCustomProvider;
}

// ============================================
// MAIN: GET MODEL STRING OR INSTANCE
// ============================================

/**
 * Get the model for Mastra agent.
 * 
 * For native providers: returns "provider/model" string (Mastra resolves it)
 * For custom providers: returns model instance (createOpenAICompatible)
 * 
 * This function reads config EVERY CALL — so settings changes take effect immediately.
 */
export function getModelForAgent(): any {
  const config = readConfig();
  const { provider, model, customProvider } = config;

  // ═══════════════════════════════════════════════════════════════
  // ANTHROPIC — Use provider instance with API key from profiles
  // ═══════════════════════════════════════════════════════════════
  if (provider === "anthropic") {
    const apiKey = getApiKeyForProvider("anthropic");
    if (apiKey) {
      const anthropic = getAnthropicProvider(apiKey);
      return anthropic(model);
    }
    // Fallback to Mastra string (uses env var)
    return `anthropic/${model}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // OPENAI — Use provider instance with API key from profiles
  // ═══════════════════════════════════════════════════════════════
  if (provider === "openai") {
    const apiKey = getApiKeyForProvider("openai");
    if (apiKey) {
      const openai = getOpenAIProvider(apiKey);
      return openai(model);
    }
    return `openai/${model}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // GOOGLE — Use provider instance with API key from profiles
  // ═══════════════════════════════════════════════════════════════
  if (provider === "google") {
    const apiKey = getApiKeyForProvider("google");
    if (apiKey) {
      const google = getGoogleProvider(apiKey);
      return google(model);
    }
    return `google/${model}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // OPENROUTER — Use provider instance with API key from profiles
  // ═══════════════════════════════════════════════════════════════
  if (provider === "openrouter") {
    const apiKey = getApiKeyForProvider("openrouter");
    if (apiKey) {
      const openrouter = getOpenRouterProvider(apiKey);
      return openrouter(model);
    }
    return `openrouter/${model}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // OLLAMA LOCAL
  // ═══════════════════════════════════════════════════════════════
  if (provider === "ollama") {
    const baseURL = customProvider?.baseURL || "http://localhost:11434/v1";
    const ollama = getCustomProvider(baseURL, "ollama", "ollama");
    return ollama(model);
  }

  // ═══════════════════════════════════════════════════════════════
  // OLLAMA CLOUD / CUSTOM
  // ═══════════════════════════════════════════════════════════════
  if (provider === "ollama-cloud" || provider === "custom") {
    if (!customProvider?.baseURL) {
      throw new Error(`${provider}: baseURL not configured. Set LLM_BASE_URL env var.`);
    }
    const custom = getCustomProvider(customProvider.baseURL, customProvider.apiKey, customProvider.name || provider);
    return custom(model);
  }

  // ═══════════════════════════════════════════════════════════════
  // OTHER NATIVE PROVIDERS (xai, deepseek, mistral, cohere, groq)
  // ═══════════════════════════════════════════════════════════════
  if (MASTRA_NATIVE_PROVIDERS.has(provider)) {
    return `${provider}/${model}`;
  }

  // Fallback
  return `${provider}/${model}`;
}

/**
 * Get model as a FUNCTION — for dynamic agent model.
 * Agent calls this each time it processes a message.
 * 
 * Usage: model: getDynamicModel()
 */
export function getDynamicModel(): () => any {
  return () => getModelForAgent();
}

/**
 * Get current model info (for display in UI).
 */
export function getCurrentModelInfo(): { provider: string; model: string; displayName: string } {
  const config = readConfig();
  return {
    provider: config.provider,
    model: config.model,
    displayName: `${config.provider}/${config.model}`,
  };
}
