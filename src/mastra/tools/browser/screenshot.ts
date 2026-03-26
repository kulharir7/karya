import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getStagehand } from "@/lib/stagehand";
import * as fs from "fs";
import * as path from "path";

export const screenshotTool = createTool({
  id: "browser-screenshot",
  description: "Take a screenshot of the current web page. Saves it to a file and returns the path.",
  inputSchema: z.object({
    filename: z
      .string()
      .optional()
      .describe("Optional filename for the screenshot (default: screenshot-{timestamp}.png)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string(),
  }),
  execute: async ({ filename }) => {
    const stagehand = await getStagehand();
    const page = stagehand.context.pages()[0];
    const fname = filename || `screenshot-${Date.now()}.png`;
    const screenshotDir = path.join(process.cwd(), "screenshots");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const filePath = path.join(screenshotDir, fname);
    await page.screenshot({ path: filePath, fullPage: false });
    return {
      success: true,
      path: filePath,
    };
  },
});
