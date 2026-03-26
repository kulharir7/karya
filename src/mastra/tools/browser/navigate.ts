import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getStagehand } from "@/lib/stagehand";

export const navigateTool = createTool({
  id: "browser-navigate",
  description: "Navigate the browser to a specific URL. Use this to open any website.",
  inputSchema: z.object({
    url: z.string().describe("The URL to navigate to (e.g., https://google.com)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    url: z.string(),
    title: z.string(),
  }),
  execute: async ({ url }) => {
    const stagehand = await getStagehand();
    const page = stagehand.context.pages()[0];
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const title = await page.title();
    return {
      success: true,
      url,
      title,
    };
  },
});
