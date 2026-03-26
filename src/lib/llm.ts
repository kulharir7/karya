import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Ollama Cloud (or any OpenAI-compatible API)
const llmProvider = createOpenAICompatible({
  name: "ollama-cloud",
  baseURL: process.env.LLM_BASE_URL || "https://ollama.com/v1",
  apiKey: process.env.LLM_API_KEY || "ollama",
});

export const MODEL_ID = process.env.LLM_MODEL || "qwen3-coder:480b";

// Return as any to avoid version conflicts between ai-sdk and mastra types
export function getModel(): any {
  return llmProvider(MODEL_ID);
}
