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

// ============================================
// CONFIG
// ============================================

const CONFIG_PATH = path.join(process.cwd(), "karya-config.json");

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
// CUSTOM PROVIDER CACHE
// ============================================

let cachedCustomProvider: any = null;
let cachedCustomKey = "";

function getCustomProvider(baseURL: string, apiKey: string, name: string) {
  const key = `${baseURL}:${apiKey}`;
  if (cachedCustomProvider && cachedCustomKey === key) {
    return cachedCustomProvider;
  }

  cachedCustomProvider = createOpenAICompatible({
    name,
    baseURL,
    apiKey: apiKey || "none",
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

  // Native Mastra providers — just return string
  if (MASTRA_NATIVE_PROVIDERS.has(provider)) {
    return `${provider}/${model}`;
  }

  // Ollama local
  if (provider === "ollama") {
    const baseURL = customProvider?.baseURL || "http://localhost:11434/v1";
    const ollama = getCustomProvider(baseURL, "ollama", "ollama");
    return ollama(model);
  }

  // Ollama Cloud / custom OpenAI-compatible
  if (provider === "ollama-cloud" || provider === "custom") {
    if (!customProvider?.baseURL) {
      throw new Error(`${provider}: baseURL not configured. Set LLM_BASE_URL env var.`);
    }
    const custom = getCustomProvider(customProvider.baseURL, customProvider.apiKey, customProvider.name || provider);
    return custom(model);
  }

  // Fallback: try as Mastra native string anyway
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
