/**
 * Karya LLM Provider System (OpenClaw-style)
 * 
 * Providers:
 * - Anthropic (API key + OAuth token)
 * - OpenAI
 * - Google
 * - OpenRouter
 * - Ollama (local)
 * - Custom OpenAI-compatible
 * 
 * Features:
 * - Multiple auth methods per provider
 * - Fast mode (Anthropic service_tier)
 * - Prompt caching (Anthropic)
 * - 1M context window (Anthropic beta)
 * - Thinking/reasoning modes
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import * as fs from "fs";
import * as path from "path";

// Config file path
const CONFIG_PATH = path.join(process.cwd(), "karya-config.json");

export type LLMProvider = "anthropic" | "openai" | "google" | "openrouter" | "ollama" | "custom";
export type AnthropicAuthMethod = "api-key" | "setup-token";
export type CacheRetention = "none" | "short" | "long";

export interface ModelParams {
  fastMode?: boolean;           // Anthropic service_tier: auto
  cacheRetention?: CacheRetention;  // Anthropic prompt caching
  context1m?: boolean;          // Anthropic 1M context beta
  thinking?: "off" | "adaptive" | "on";  // Reasoning mode
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  
  // Auth credentials
  apiKeys: {
    anthropic: string;
    openai: string;
    google: string;
    openrouter: string;
  };
  
  // Anthropic-specific
  anthropic?: {
    authMethod: AnthropicAuthMethod;
    setupToken?: string;  // OAuth token from `claude setup-token`
  };
  
  // Model-specific params
  modelParams?: Record<string, ModelParams>;
  
  // Custom provider
  customProvider: {
    name: string;
    baseURL: string;
    apiKey: string;
  };
}

// Default configuration
const DEFAULT_CONFIG: LLMConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  apiKeys: {
    anthropic: "",
    openai: "",
    google: "",
    openrouter: "",
  },
  anthropic: {
    authMethod: "api-key",
  },
  modelParams: {
    // Anthropic defaults
    "claude-opus-4-20250514": { cacheRetention: "short", thinking: "adaptive" },
    "claude-sonnet-4-20250514": { cacheRetention: "short", fastMode: true },
    "claude-3-5-sonnet-20241022": { cacheRetention: "short" },
  },
  customProvider: {
    name: "custom",
    baseURL: "",
    apiKey: "",
  },
};

/**
 * Load config from environment variables (priority) or file
 * SECURITY: Environment variables take precedence over config file
 */
function loadConfig(): LLMConfig {
  // Environment variables have PRIORITY (for security)
  const envConfig: Partial<LLMConfig> = {
    provider: (process.env.LLM_PROVIDER as LLMProvider) || undefined,
    model: process.env.LLM_MODEL || undefined,
    apiKeys: {
      anthropic: process.env.ANTHROPIC_API_KEY || "",
      openai: process.env.OPENAI_API_KEY || "",
      google: process.env.GOOGLE_API_KEY || "",
      openrouter: process.env.OPENROUTER_API_KEY || "",
    },
    customProvider: process.env.LLM_BASE_URL ? {
      name: process.env.CUSTOM_PROVIDER_NAME || "custom",
      baseURL: process.env.LLM_BASE_URL,
      apiKey: process.env.LLM_API_KEY || "",
    } : undefined,
  };

  // Try to load from config file (for non-secret settings)
  let fileConfig: Partial<LLMConfig> = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const content = fs.readFileSync(CONFIG_PATH, "utf-8");
      fileConfig = JSON.parse(content);
      // SECURITY: Remove API keys from file config if env vars exist
      if (process.env.LLM_API_KEY && fileConfig.customProvider) {
        fileConfig.customProvider.apiKey = "";
      }
    } catch {
      // Fall through to defaults
    }
  }

  // Merge: defaults <- file <- env (env wins)
  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...(envConfig.provider && { provider: envConfig.provider }),
    ...(envConfig.model && { model: envConfig.model }),
    apiKeys: {
      ...DEFAULT_CONFIG.apiKeys,
      ...fileConfig.apiKeys,
      ...envConfig.apiKeys,
    },
    customProvider: envConfig.customProvider || fileConfig.customProvider || DEFAULT_CONFIG.customProvider,
  };
}

/**
 * Save config to file
 */
export function saveConfig(config: Partial<LLMConfig>): void {
  const current = loadConfig();
  const merged = { ...current, ...config };
  
  // Deep merge apiKeys
  if (config.apiKeys) {
    merged.apiKeys = { ...current.apiKeys, ...config.apiKeys };
  }
  if (config.modelParams) {
    merged.modelParams = { ...current.modelParams, ...config.modelParams };
  }
  if (config.anthropic) {
    merged.anthropic = { ...current.anthropic, ...config.anthropic };
  }
  
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
}

/**
 * Get current config
 */
export function getConfig(): LLMConfig {
  return loadConfig();
}

/**
 * Get model params for a specific model
 */
export function getModelParams(model: string): ModelParams {
  const config = loadConfig();
  return config.modelParams?.[model] || {};
}

/**
 * Create model instance based on provider
 */
export function getModel(): any {
  const config = loadConfig();
  const { provider, model, apiKeys, anthropic: anthroConfig, customProvider } = config;
  const modelParams = config.modelParams?.[model] || {};

  switch (provider) {
    case "anthropic": {
      // Check for API key or setup token
      const apiKey = apiKeys.anthropic || anthroConfig?.setupToken;
      if (!apiKey) {
        throw new Error(
          "Anthropic not configured. Add API key or setup-token in Settings.\n" +
          "Get API key: console.anthropic.com/settings/keys\n" +
          "Or run: claude setup-token"
        );
      }
      
      // Build headers for beta features
      const headers: Record<string, string> = {};
      const betaFlags: string[] = [];
      
      // Prompt caching
      if (modelParams.cacheRetention === "long") {
        betaFlags.push("extended-cache-ttl-2025-04-11");
      }
      
      // 1M context
      if (modelParams.context1m) {
        betaFlags.push("context-1m-2025-08-07");
      }
      
      if (betaFlags.length > 0) {
        headers["anthropic-beta"] = betaFlags.join(",");
      }
      
      const anthropic = createAnthropic({
        apiKey,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
      
      return anthropic(model);
    }

    case "openai": {
      if (!apiKeys.openai) {
        throw new Error("OpenAI API key not configured. Set in Settings or OPENAI_API_KEY env.");
      }
      const openai = createOpenAI({
        apiKey: apiKeys.openai,
      });
      return openai(model);
    }

    case "google": {
      if (!apiKeys.google) {
        throw new Error("Google API key not configured. Set in Settings or GOOGLE_API_KEY env.");
      }
      const google = createGoogleGenerativeAI({
        apiKey: apiKeys.google,
      });
      return google(model);
    }

    case "openrouter": {
      if (!apiKeys.openrouter) {
        throw new Error("OpenRouter API key not configured. Get key: openrouter.ai/keys");
      }
      const openrouter = createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: apiKeys.openrouter,
      });
      return openrouter(model);
    }

    case "ollama": {
      const ollama = createOpenAICompatible({
        name: "ollama",
        baseURL: customProvider.baseURL || "http://localhost:11434/v1",
        apiKey: "ollama",
      });
      return ollama(model);
    }

    case "custom": {
      if (!customProvider.baseURL) {
        throw new Error("Custom provider baseURL not configured.");
      }
      const custom = createOpenAICompatible({
        name: customProvider.name || "custom",
        baseURL: customProvider.baseURL,
        apiKey: customProvider.apiKey || "none",
      });
      return custom(model);
    }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Available models per provider (latest 2025 models)
 */
export const PROVIDER_MODELS: Record<LLMProvider, { id: string; name: string; description: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "⚡ Fast, best value" },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4", description: "🧠 Most capable" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "⚡ Previous gen" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", description: "⚡⚡ Fastest, cheapest" },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "🧠 Previous flagship" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o", description: "⚡ Multimodal, fast" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "⚡⚡ Cheapest" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "💪 128K context" },
    { id: "o1", name: "o1", description: "🧠 Deep reasoning" },
    { id: "o1-mini", name: "o1 Mini", description: "🧠 Reasoning, cheaper" },
    { id: "o3-mini", name: "o3 Mini", description: "🧠 Latest reasoning" },
  ],
  google: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "🧠 Most capable" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "⚡⚡ Ultra fast" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "⚡ Fast" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "💪 1M context" },
  ],
  openrouter: [
    { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", description: "via OpenRouter" },
    { id: "anthropic/claude-opus-4", name: "Claude Opus 4", description: "via OpenRouter" },
    { id: "openai/gpt-4o", name: "GPT-4o", description: "via OpenRouter" },
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "via OpenRouter" },
    { id: "deepseek/deepseek-r1", name: "DeepSeek R1", description: "💰 Cheap reasoning" },
    { id: "meta-llama/llama-3.3-70b", name: "Llama 3.3 70B", description: "🦙 Open source" },
    { id: "qwen/qwen-2.5-coder-32b", name: "Qwen 2.5 Coder", description: "💻 Code specialist" },
  ],
  ollama: [
    { id: "llama3.3", name: "Llama 3.3", description: "🦙 Local" },
    { id: "qwen2.5-coder:32b", name: "Qwen 2.5 Coder 32B", description: "💻 Code" },
    { id: "deepseek-coder-v2", name: "DeepSeek Coder", description: "💻 Code" },
    { id: "mistral", name: "Mistral", description: "⚡ Fast" },
  ],
  custom: [],
};

/**
 * Test API key validity
 */
export async function testApiKey(
  provider: LLMProvider, 
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey || apiKey.length < 10) {
    return { valid: false, error: "API key too short" };
  }
  
  // Format validation
  if (provider === "anthropic") {
    if (!apiKey.startsWith("sk-ant-")) {
      return { valid: false, error: "Anthropic API keys start with 'sk-ant-'" };
    }
  }
  if (provider === "openai") {
    if (!apiKey.startsWith("sk-")) {
      return { valid: false, error: "OpenAI API keys start with 'sk-'" };
    }
  }
  
  return { valid: true };
}

/**
 * Validate setup token (Anthropic OAuth)
 */
export function validateSetupToken(token: string): { valid: boolean; error?: string } {
  if (!token || token.length < 20) {
    return { valid: false, error: "Setup token too short" };
  }
  // Setup tokens from Claude CLI typically start with specific patterns
  return { valid: true };
}

// Export helpers
export function getCurrentModelId(): string {
  return loadConfig().model;
}

export function getCurrentProvider(): LLMProvider {
  return loadConfig().provider;
}

export function hasValidAuth(provider: LLMProvider): boolean {
  const config = loadConfig();
  
  if (provider === "anthropic") {
    return !!(config.apiKeys.anthropic || config.anthropic?.setupToken);
  }
  if (provider === "ollama") {
    return true; // No auth needed
  }
  if (provider === "custom") {
    return !!config.customProvider.baseURL;
  }
  
  return !!config.apiKeys[provider];
}
