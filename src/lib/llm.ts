import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Ollama Cloud (or any OpenAI-compatible API)
export const llmProvider = createOpenAICompatible({
  name: "ollama-cloud",
  baseURL: process.env.LLM_BASE_URL || "https://ollama.com/v1",
  apiKey: process.env.LLM_API_KEY || "ollama",
});

export const MODEL_ID = process.env.LLM_MODEL || "qwen3-coder:480b";

export function getModel() {
  return llmProvider(MODEL_ID);
}
