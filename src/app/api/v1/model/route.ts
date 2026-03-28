/**
 * GET  /api/v1/model — Get current model info
 * POST /api/v1/model — Switch model (instant, no restart)
 * 
 * POST body:
 *   { "provider": "ollama-cloud", "model": "qwen3-coder:480b" }
 *   { "action": "test" } — Test current model with a simple prompt
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiBadRequest, apiServerError } from "@/lib/api-response";
import { getCurrentModelInfo, getModelForAgent } from "@/lib/model-router";
import { getConfig, saveConfig } from "@/lib/llm";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "read");
  if (guard) return guard;

  try {
    const info = getCurrentModelInfo();
    const config = getConfig();
    return apiOk({
      ...info,
      hasKey: !!config.apiKeys[config.provider as keyof typeof config.apiKeys] ||
              !!config.customProvider?.apiKey ||
              !!process.env.LLM_API_KEY,
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
    const { action, provider, model } = body;

    // Test current model
    if (action === "test") {
      const startTime = Date.now();
      try {
        const { generateText } = await import("ai");
        const llm = getModelForAgent();
        const result = await generateText({
          model: llm as any,
          prompt: "Say 'Hello from Karya!' in exactly 5 words.",
          maxOutputTokens: 50,
        });
        return apiOk({
          success: true,
          response: result.text,
          latencyMs: Date.now() - startTime,
          model: getCurrentModelInfo().displayName,
        });
      } catch (err: any) {
        return apiOk({
          success: false,
          error: err.message,
          latencyMs: Date.now() - startTime,
          model: getCurrentModelInfo().displayName,
        });
      }
    }

    // Switch model
    if (provider && model) {
      saveConfig({ provider, model });
      const info = getCurrentModelInfo();
      return apiOk({
        switched: true,
        ...info,
        message: `Model switched to ${info.displayName}. Next message will use this model.`,
      });
    }

    if (model) {
      saveConfig({ model });
      return apiOk({ switched: true, model, message: `Model switched to ${model}.` });
    }

    return apiBadRequest("Provide provider + model, or action: 'test'");
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
