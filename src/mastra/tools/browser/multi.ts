import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getStagehand } from "@/lib/stagehand";

export const browserAgentTool = createTool({
  id: "browser-agent",
  description:
    "Execute a complex multi-step browser task using natural language. " +
    "Use for tasks needing multiple clicks, navigations, and data extraction. " +
    "Examples: 'Go to Amazon, search headphones, find cheapest', " +
    "'Open LinkedIn and check notifications'. " +
    "If browser unavailable, break the task into web-search + api-call steps instead.",
  inputSchema: z.object({
    task: z.string().describe("Full description of the multi-step browser task"),
    startUrl: z.string().optional().describe("Optional starting URL"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    result: z.string(),
    steps: z.number(),
  }),
  execute: async ({ task, startUrl }) => {
    try {
      const stagehand = await getStagehand();

      if (startUrl) {
        const page = stagehand.context.pages()[0];
        await page.goto(startUrl, { waitUntil: "domcontentloaded", timeoutMs: 15000 });
      }

      const agent = stagehand.agent();
      const result = await agent.execute(task);

      return {
        success: true,
        result: JSON.stringify(result, null, 2),
        steps: 1,
      };
    } catch (err: any) {
      return {
        success: false,
        result: `❌ Browser error: ${err.message}. Try breaking this into web-search + individual steps.`,
        steps: 0,
      };
    }
  },
});
