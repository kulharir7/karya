import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getStagehand } from "@/lib/stagehand";

export const browserAgentTool = createTool({
  id: "browser-agent",
  description:
    "Execute a complex multi-step browser task using natural language. " +
    "Use this for tasks that require multiple clicks, navigations, and data extraction. " +
    "Examples: 'Go to Amazon, search for headphones, and find the cheapest one', " +
    "'Open LinkedIn and check my notifications', " +
    "'Go to MakeMyTrip and search flights from Delhi to Mumbai on March 28'",
  inputSchema: z.object({
    task: z.string().describe("Full description of the multi-step browser task to execute"),
    startUrl: z.string().optional().describe("Optional starting URL (otherwise starts from current page)"),
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
        await page.goto(startUrl, { waitUntil: "domcontentloaded" });
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
        result: `Error: ${err.message}`,
        steps: 0,
      };
    }
  },
});
