/**
 * Settings API — LLM Provider Configuration (OpenClaw-style)
 * 
 * GET: Retrieve current settings
 * POST: Update settings (provider, model, API keys, tokens, params)
 */

import { NextRequest } from "next/server";
import { 
  getConfig, 
  saveConfig, 
  testApiKey,
  validateSetupToken,
  PROVIDER_MODELS,
  LLMProvider,
  LLMConfig,
  hasValidAuth,
  ModelParams,
} from "@/lib/llm";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "models") {
    return Response.json({ models: PROVIDER_MODELS });
  }

  if (action === "test-key") {
    const provider = url.searchParams.get("provider") as LLMProvider;
    const key = url.searchParams.get("key") || "";
    const result = await testApiKey(provider, key);
    return Response.json(result);
  }

  // Return current config (mask secrets)
  const config = getConfig();
  
  const masked: any = {
    provider: config.provider,
    model: config.model,
    modelParams: config.modelParams,
    anthropic: {
      authMethod: config.anthropic?.authMethod || "api-key",
      hasSetupToken: !!config.anthropic?.setupToken,
    },
    customProvider: {
      name: config.customProvider.name,
      baseURL: config.customProvider.baseURL,
      hasApiKey: !!config.customProvider.apiKey,
    },
    hasKeys: {
      anthropic: hasValidAuth("anthropic"),
      openai: hasValidAuth("openai"),
      google: hasValidAuth("google"),
      openrouter: hasValidAuth("openrouter"),
      ollama: true,
      custom: hasValidAuth("custom"),
    },
    // Masked key previews
    keyPreviews: {
      anthropic: config.apiKeys.anthropic ? "sk-ant-***" + config.apiKeys.anthropic.slice(-4) : null,
      openai: config.apiKeys.openai ? "sk-***" + config.apiKeys.openai.slice(-4) : null,
      google: config.apiKeys.google ? "***" + config.apiKeys.google.slice(-4) : null,
      openrouter: config.apiKeys.openrouter ? "sk-***" + config.apiKeys.openrouter.slice(-4) : null,
    },
  };

  return Response.json(masked);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "setProvider": {
        const { provider, model } = body;
        saveConfig({ provider, model });
        return Response.json({ success: true, provider, model });
      }

      case "setModel": {
        const { model } = body;
        saveConfig({ model });
        return Response.json({ success: true, model });
      }

      case "setApiKey": {
        const { provider, apiKey } = body;
        
        // For Anthropic, detect if it's an OAuth token vs API key
        if (provider === "anthropic") {
          if (apiKey.startsWith("sk-ant-oat")) {
            // This is an OAuth/setup token, not API key
            saveConfig({
              anthropic: { authMethod: "setup-token", setupToken: apiKey },
            });
            return Response.json({ success: true, provider, authMethod: "setup-token" });
          }
        }
        
        // Validate key format
        const validation = await testApiKey(provider, apiKey);
        if (!validation.valid) {
          return Response.json({ success: false, error: validation.error }, { status: 400 });
        }
        
        const config = getConfig();
        const apiKeys = { ...config.apiKeys, [provider]: apiKey };
        
        // For Anthropic, clear setup token when setting API key
        if (provider === "anthropic") {
          saveConfig({ 
            apiKeys,
            anthropic: { authMethod: "api-key", setupToken: undefined }
          });
        } else {
          saveConfig({ apiKeys });
        }
        
        return Response.json({ success: true, provider });
      }

      case "setSetupToken": {
        // Anthropic OAuth setup token
        const { token } = body;
        
        const validation = validateSetupToken(token);
        if (!validation.valid) {
          return Response.json({ success: false, error: validation.error }, { status: 400 });
        }
        
        saveConfig({
          anthropic: {
            authMethod: "setup-token",
            setupToken: token,
          },
        });
        
        return Response.json({ success: true });
      }

      case "setAnthropicAuth": {
        // Switch Anthropic auth method
        const { method, apiKey, setupToken } = body;
        
        if (method === "api-key") {
          if (!apiKey) {
            return Response.json({ success: false, error: "API key required" }, { status: 400 });
          }
          const config = getConfig();
          saveConfig({
            apiKeys: { ...config.apiKeys, anthropic: apiKey },
            anthropic: { authMethod: "api-key" },
          });
        } else if (method === "setup-token") {
          if (!setupToken) {
            return Response.json({ success: false, error: "Setup token required" }, { status: 400 });
          }
          saveConfig({
            anthropic: { authMethod: "setup-token", setupToken },
          });
        }
        
        return Response.json({ success: true, method });
      }

      case "setModelParams": {
        // Set model-specific params (fastMode, caching, etc.)
        const { model, params } = body as { model: string; params: ModelParams };
        const config = getConfig();
        const modelParams = { ...config.modelParams, [model]: params };
        saveConfig({ modelParams });
        return Response.json({ success: true, model, params });
      }

      case "setCustomProvider": {
        const { name, baseURL, apiKey } = body;
        saveConfig({
          provider: "custom",
          customProvider: { name: name || "custom", baseURL, apiKey: apiKey || "" },
        });
        return Response.json({ success: true });
      }

      case "clearAuth": {
        // Clear auth for a provider
        const { provider } = body;
        const config = getConfig();
        
        if (provider === "anthropic") {
          saveConfig({
            apiKeys: { ...config.apiKeys, anthropic: "" },
            anthropic: { authMethod: "api-key", setupToken: undefined },
          });
        } else {
          const apiKeys = { ...config.apiKeys, [provider]: "" };
          saveConfig({ apiKeys });
        }
        
        return Response.json({ success: true });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Settings API error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
