import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as path from "path";

export const resizeImageTool = createTool({
  id: "file-resize-image",
  description:
    "Resize an image to specified dimensions. Use when user wants to resize, " +
    "compress, or convert images. Supports jpg, png, webp.",
  inputSchema: z.object({
    filePath: z.string().describe("Path to the image file"),
    width: z.number().describe("Target width in pixels"),
    height: z.number().optional().describe("Target height (optional, maintains aspect ratio if omitted)"),
    outputPath: z.string().optional().describe("Output path (optional, defaults to same folder with _resized suffix)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    outputPath: z.string(),
    info: z.string(),
  }),
  execute: async ({ filePath, width, height, outputPath }) => {
    try {
      const sharp = (await import("sharp")).default;
      const resolved = path.resolve(filePath);
      const ext = path.extname(resolved);
      const base = path.basename(resolved, ext);
      const dir = path.dirname(resolved);
      const outPath = outputPath
        ? path.resolve(outputPath)
        : path.join(dir, `${base}_resized${ext}`);

      const resizeOpts: { width: number; height?: number } = { width };
      if (height) resizeOpts.height = height;

      const info = await sharp(resolved)
        .resize(resizeOpts)
        .toFile(outPath);

      return {
        success: true,
        outputPath: outPath,
        info: `Resized to ${info.width}x${info.height}, ${(info.size / 1024).toFixed(1)} KB`,
      };
    } catch (err: any) {
      return {
        success: false,
        outputPath: "",
        info: `Error: ${err.message}`,
      };
    }
  },
});
