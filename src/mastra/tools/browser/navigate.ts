import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getStagehand } from "@/lib/stagehand";

export const navigateTool = createTool({
  id: "browser-navigate",
  description: "Navigate the browser to a specific URL. Use this to open any website. If browser is unavailable, use web-search instead.",
  inputSchema: z.object({
    url: z.string().describe("The URL to navigate to (e.g., https://google.com)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    url: z.string(),
    title: z.string(),
  }),
  execute: async ({ url }) => {
    try {
      const stagehand = await getStagehand();
      const page = stagehand.context.pages()[0];
      await page.goto(url, { waitUntil: "domcontentloaded", timeoutMs: 15000 });
      const title = await page.title();
      return { success: true, url, title };
    } catch (err: any) {
      return {
        success: false,
        url,
        title: `❌ Browser error: ${err.message}. Try using web-search tool instead.`,
      };
    }
  },
});
