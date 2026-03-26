import { Stagehand } from "@browserbasehq/stagehand";

let stagehandInstance: Stagehand | null = null;

export async function getStagehand(): Promise<Stagehand> {
  if (!stagehandInstance) {
    stagehandInstance = new Stagehand({
      env: "LOCAL",
      headless: false,
      verbose: 1,
      enableCaching: true,
      modelName: "gpt-4o", // Stagehand's internal vision model
      modelClientOptions: {
        apiKey: process.env.LLM_API_KEY || "ollama",
        baseURL: process.env.LLM_BASE_URL || "https://ollama.com/v1",
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
