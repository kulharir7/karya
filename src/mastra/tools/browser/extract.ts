import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getStagehand } from "@/lib/stagehand";

export const extractTool = createTool({
  id: "browser-extract",
  description:
    "Extract structured data from the current web page. " +
    "Describe what data you want to extract in natural language. " +
    "Returns the extracted text content.",
  inputSchema: z.object({
    instruction: z
      .string()
      .describe("What data to extract from the page (e.g., 'all product names and prices')"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.string(),
  }),
  execute: async ({ context }) => {
    const stagehand = await getStagehand();
    const result = await stagehand.extract({
      instruction: context.instruction,
      schema: z.object({
        extracted: z.string().describe("The extracted data"),
      }),
    });
    return {
      success: true,
      data: JSON.stringify(result, null, 2),
    };
  },
});
