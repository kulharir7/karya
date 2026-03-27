/**
 * Karya LLM Provider System
 * 
 * Supports multiple providers:
 * - Anthropic (Claude)
 * - OpenAI
 * - Google (Gemini)
 * - Ollama (local/cloud)
 * - OpenRouter
 * - Custom OpenAI-compatible
 * 
 * Configuration via environment variables OR runtime settings.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import * as fs from "fs";
import * as path from "path";

// Config file path
const CONFIG_PATH = path.join(process.cwd(), "karya-config.json");

// Default configuration
const DEFAULT_CONFIG = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  apiKeys: {
    anthropic: "",
    openai: "",
    google: "",
    openrouter: "",
  },
  customProvider: {
    name: "custom",
    baseURL: "",
    apiKey: "",
  },
};

export type LLMProvider = "anthropic" | "openai" | "google" | "openrouter" | "ollama" | "custom";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKeys: {
    anthropic: string;
    openai: string;
    google: string;
    openrouter: string;
  };
  customProvider: {
    name: string;
    baseURL: string;
    apiKey: string;
  };
}

/**
 * Load config from file or environment
 */
function loadConfig(): LLMConfig {
  // Try to load from config file
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const content = fs.readFileSync(CONFIG_PATH, "utf-8");
      const saved = JSON.parse(content);
      return { ...DEFAULT_CONFIG, ...saved };
    } catch {
      // Fall through to env vars
    }
  }

  // Fall back to environment variables
  return {
    provider: (process.env.LLM_PROVIDER as LLMProvider) || "anthropic",
    model: process.env.LLM_MODEL || "claude-sonnet-4-20250514",
    apiKeys: {
      anthropic: process.env.ANTHROPIC_API_KEY || "",
      openai: process.env.OPENAI_API_KEY || "",
      google: process.env.GOOGLE_API_KEY || "",
      openrouter: process.env.OPENROUTER_API_KEY || "",
    },
    customProvider: {
      name: "custom",
      baseURL: process.env.LLM_BASE_URL || "",
      apiKey: process.env.LLM_API_KEY || "",
    },
  };
}

/**
 * Save config to file
 */
export function saveConfig(config: Partial<LLMConfig>): void {
  const current = loadConfig();
  const merged = { ...current, ...config };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
}

/**
 * Get current config
 */
export function getConfig(): LLMConfig {
  return loadConfig();
}

/**
 * Create model instance based on provider
 */
export function getModel(): any {
  const config = loadConfig();
  const { provider, model, apiKeys, customProvider } = config;

  switch (provider) {
    case "anthropic": {
      if (!apiKeys.anthropic) {
        throw new Error("Anthropic API key not configured. Set ANTHROPIC_API_KEY or configure in settings.");
      }
      const anthropic = createAnthropic({
        apiKey: apiKeys.anthropic,
      });
      return anthropic(model);
    }

    case "openai": {
      if (!apiKeys.openai) {
        throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY or configure in settings.");
      }
      const openai = createOpenAI({
        apiKey: apiKeys.openai,
      });
      return openai(model);
    }

    case "google": {
      if (!apiKeys.google) {
        throw new Error("Google API key not configured. Set GOOGLE_API_KEY or configure in settings.");
      }
      const google = createGoogleGenerativeAI({
        apiKey: apiKeys.google,
      });
      return google(model);
    }

    case "openrouter": {
      if (!apiKeys.openrouter) {
        throw new Error("OpenRouter API key not configured. Set OPENROUTER_API_KEY or configure in settings.");
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
 * Get available models for each provider
 */
export const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514", 
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
  ],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
    "o1",
    "o1-mini",
  ],
  google: [
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
  openrouter: [
    "anthropic/claude-sonnet-4",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "google/gemini-2.0-flash",
    "meta-llama/llama-3.3-70b",
    "deepseek/deepseek-chat-v3",
  ],
  ollama: [
    "llama3.3",
    "qwen2.5-coder",
    "deepseek-coder-v2",
    "codellama",
  ],
  custom: [],
};

/**
 * Test API key validity
 */
export async function testApiKey(provider: LLMProvider, apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Just check if key is non-empty for now
    // Real validation would make a test API call
    if (!apiKey || apiKey.length < 10) {
      return { valid: false, error: "API key too short" };
    }
    
    // Basic format validation
    if (provider === "anthropic" && !apiKey.startsWith("sk-ant-")) {
      return { valid: false, error: "Anthropic keys start with sk-ant-" };
    }
    if (provider === "openai" && !apiKey.startsWith("sk-")) {
      return { valid: false, error: "OpenAI keys start with sk-" };
    }
    
    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

// Export current model ID for display
export function getCurrentModelId(): string {
  const config = loadConfig();
  return config.model;
}

export function getCurrentProvider(): LLMProvider {
  const config = loadConfig();
  return config.provider;
}
