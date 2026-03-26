import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export const readPdfTool = createTool({
  id: "file-read-pdf",
  description:
    "Read and extract text from a PDF file. Use when the user wants to read a PDF, " +
    "extract data from a PDF, or convert PDF to text.",
  inputSchema: z.object({
    filePath: z.string().describe("Path to the PDF file"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    text: z.string(),
    pages: z.number(),
    info: z.string(),
  }),
  execute: async ({ filePath }) => {
    try {
      const resolved = path.resolve(filePath);
      const buffer = fs.readFileSync(resolved);
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      return {
        success: true,
        text: data.text.slice(0, 30000), // Limit to 30KB
        pages: data.numpages,
        info: `${data.numpages} pages, ${(buffer.length / 1024).toFixed(1)} KB`,
      };
    } catch (err: any) {
      return {
        success: false,
        text: "",
        pages: 0,
        info: `Error: ${err.message}`,
      };
    }
  },
});
