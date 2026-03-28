import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getStagehand } from "@/lib/stagehand";

export const extractTool = createTool({
  id: "browser-extract",
  description:
    "Extract structured data from the current web page using natural language. " +
    "Describe what data you want. Requires browser-navigate to be called first.",
  inputSchema: z.object({
    instruction: z.string().describe("What data to extract (e.g., 'all product names and prices')"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.string(),
  }),
  execute: async ({ instruction }) => {
    try {
      const stagehand = await getStagehand();
      const result = await stagehand.extract(instruction);
      return { success: true, data: JSON.stringify(result, null, 2) };
    } catch (err: any) {
      return {
        success: false,
        data: `❌ Browser error: ${err.message}. Navigate to a page first, or use web-search + api-call.`,
      };
    }
  },
});
