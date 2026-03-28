import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getStagehand } from "@/lib/stagehand";

export const actTool = createTool({
  id: "browser-act",
  description:
    "Perform a single action on the current web page using natural language. " +
    "Examples: 'click the login button', 'type hello in the search box', " +
    "'scroll down', 'select the second option from dropdown'. " +
    "Requires browser-navigate to be called first.",
  inputSchema: z.object({
    action: z.string().describe("Natural language description of the action to perform"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ action }) => {
    try {
      const stagehand = await getStagehand();
      await stagehand.act(action);
      return { success: true, message: `Action performed: ${action}` };
    } catch (err: any) {
      return {
        success: false,
        message: `❌ Browser error: ${err.message}. Navigate to a page first, or use web-search.`,
      };
    }
  },
});
