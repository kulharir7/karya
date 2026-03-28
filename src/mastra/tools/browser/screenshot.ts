import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getStagehand } from "@/lib/stagehand";
import * as fs from "fs";
import * as path from "path";

export const screenshotTool = createTool({
  id: "browser-screenshot",
  description: "Take a screenshot of the current web page. Saves to screenshots/ folder. Requires browser-navigate first.",
  inputSchema: z.object({
    filename: z.string().optional().describe("Optional filename (default: screenshot-{timestamp}.png)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string(),
  }),
  execute: async ({ filename }) => {
    try {
      const stagehand = await getStagehand();
      const page = stagehand.context.pages()[0];
      const fname = filename || `screenshot-${Date.now()}.png`;
      const screenshotDir = path.join(process.cwd(), "screenshots");
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const filePath = path.join(screenshotDir, fname);
      await page.screenshot({ path: filePath, fullPage: false });
      return { success: true, path: filePath };
    } catch (err: any) {
      return {
        success: false,
        path: `❌ Browser error: ${err.message}. Use system-screenshot for screen capture instead.`,
      };
    }
  },
});
