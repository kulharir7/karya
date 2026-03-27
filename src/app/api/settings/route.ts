/**
 * Settings API — LLM Provider Configuration
 * 
 * GET: Retrieve current settings
 * POST: Update settings (provider, model, API keys)
 */

import { NextRequest } from "next/server";
import { 
  getConfig, 
  saveConfig, 
  testApiKey, 
  PROVIDER_MODELS,
  LLMProvider,
  LLMConfig 
} from "@/lib/llm";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "models") {
    // Return available models per provider
    return Response.json({ models: PROVIDER_MODELS });
  }

  if (action === "test") {
    // Test an API key
    const provider = url.searchParams.get("provider") as LLMProvider;
    const key = url.searchParams.get("key") || "";
    const result = await testApiKey(provider, key);
    return Response.json(result);
  }

  // Return current config (mask API keys)
  const config = getConfig();
  const masked: LLMConfig = {
    ...config,
    apiKeys: {
      anthropic: config.apiKeys.anthropic ? "sk-ant-***" + config.apiKeys.anthropic.slice(-4) : "",
      openai: config.apiKeys.openai ? "sk-***" + config.apiKeys.openai.slice(-4) : "",
      google: config.apiKeys.google ? "***" + config.apiKeys.google.slice(-4) : "",
      openrouter: config.apiKeys.openrouter ? "sk-***" + config.apiKeys.openrouter.slice(-4) : "",
    },
    customProvider: {
      ...config.customProvider,
      apiKey: config.customProvider.apiKey ? "***" + config.customProvider.apiKey.slice(-4) : "",
    },
  };

  return Response.json({
    config: masked,
    hasKeys: {
      anthropic: !!config.apiKeys.anthropic,
      openai: !!config.apiKeys.openai,
      google: !!config.apiKeys.google,
      openrouter: !!config.apiKeys.openrouter,
      custom: !!config.customProvider.apiKey,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "setProvider") {
      // Change provider and model
      const { provider, model } = body;
      saveConfig({ provider, model });
      return Response.json({ success: true, provider, model });
    }

    if (action === "setApiKey") {
      // Update API key for a provider
      const { provider, apiKey } = body;
      const config = getConfig();
      
      if (provider === "custom") {
        saveConfig({
          customProvider: {
            ...config.customProvider,
            apiKey,
          },
        });
      } else {
        const apiKeys = { ...config.apiKeys, [provider]: apiKey };
        saveConfig({ apiKeys });
      }
      
      return Response.json({ success: true, provider });
    }

    if (action === "setCustomProvider") {
      // Configure custom OpenAI-compatible provider
      const { name, baseURL, apiKey } = body;
      saveConfig({
        provider: "custom",
        customProvider: { name, baseURL, apiKey },
      });
      return Response.json({ success: true });
    }

    if (action === "setModel") {
      // Just change model (keep provider)
      const { model } = body;
      saveConfig({ model });
      return Response.json({ success: true, model });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
