import { Stagehand } from "@browserbasehq/stagehand";

let stagehandInstance: Stagehand | null = null;

/**
 * Get or create Stagehand browser instance
 * Uses environment variables for configuration (no hardcoded API keys)
 */
export async function getStagehand(): Promise<Stagehand> {
  if (!stagehandInstance) {
    // Get config from environment
    const modelName = process.env.STAGEHAND_MODEL || process.env.LLM_MODEL || "gpt-4o";
    const provider = process.env.STAGEHAND_PROVIDER || "openai";
    const apiKey = process.env.STAGEHAND_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
    const baseURL = process.env.STAGEHAND_BASE_URL || process.env.LLM_BASE_URL;

    if (!apiKey) {
      console.warn("[stagehand] No API key found. Set STAGEHAND_API_KEY, OPENAI_API_KEY, or LLM_API_KEY");
    }

    // @ts-ignore - Stagehand API may vary between versions
    stagehandInstance = new Stagehand({
      env: "LOCAL",
      verbose: 1,
      localBrowserLaunchOptions: {
        headless: false,
      },
    });
    await stagehandInstance.init();
  }
  return stagehandInstance;
}

export async function closeStagehand(): Promise<void> {
  if (stagehandInstance) {
    await stagehandInstance.close();
    stagehandInstance = null;
  }
}
