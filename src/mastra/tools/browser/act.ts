import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getStagehand } from "@/lib/stagehand";

export const actTool = createTool({
  id: "browser-act",
  description:
    "Perform a single action on the current web page using natural language. " +
    "Examples: 'click the login button', 'type hello in the search box', " +
    "'scroll down', 'select the second option from dropdown'.",
  inputSchema: z.object({
    action: z
      .string()
      .describe("Natural language description of the action to perform on the page"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const stagehand = await getStagehand();
    const result = await stagehand.act({ action: context.action });
    return {
      success: true,
      message: `Action performed: ${context.action}`,
    };
  },
});
