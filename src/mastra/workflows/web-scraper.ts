/**
 * Web Scraper Workflow
 * 
 * Sequential workflow: Navigate → Extract → Save
 * Demonstrates: .then() chaining
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Step 1: Navigate and extract
const navigateAndExtractStep = createStep({
  id: "navigate-extract",
  inputSchema: z.object({
    url: z.string(),
    outputPath: z.string(),
    selector: z.string().optional(),
  }),
  outputSchema: z.object({
    url: z.string(),
    outputPath: z.string(),
    pageTitle: z.string(),
    content: z.string(),
    extractedAt: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { url, outputPath, selector } = inputData;
    
    // In real implementation, this would use Stagehand/Playwright
    // For now, use a fetch-based approach
    try {
      const response = await fetch(url);
      const html = await response.text();
      
      // Extract title
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1] : "Untitled";
      
      // Extract content (simple text extraction)
      const content = selector
        ? `Content from selector: ${selector}`
        : html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 5000);
      
      return {
        url,
        outputPath,
        pageTitle,
        content,
        extractedAt: Date.now(),
      };
    } catch (error) {
      throw new Error(`Failed to fetch URL: ${url} - ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});

// Step 2: Save to file
const saveStep = createStep({
  id: "save-file",
  inputSchema: z.object({
    url: z.string(),
    outputPath: z.string(),
    pageTitle: z.string(),
    content: z.string(),
    extractedAt: z.number(),
  }),
  outputSchema: z.object({
    savedPath: z.string(),
    bytesWritten: z.number(),
    pageTitle: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { outputPath, pageTitle, content, extractedAt, url } = inputData;
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Format content with metadata
    const formattedContent = `# ${pageTitle}

**Source:** ${url}
**Extracted at:** ${new Date(extractedAt).toISOString()}

---

${content}
`;
    
    fs.writeFileSync(outputPath, formattedContent, "utf-8");
    
    return {
      savedPath: outputPath,
      bytesWritten: Buffer.byteLength(formattedContent),
      pageTitle,
    };
  },
});

// Create the workflow
export const webScraperWorkflow = createWorkflow({
  id: "web-scraper",
  inputSchema: z.object({
    url: z.string(),
    outputPath: z.string(),
    selector: z.string().optional(),
  }),
  outputSchema: z.object({
    savedPath: z.string(),
    bytesWritten: z.number(),
    pageTitle: z.string(),
  }),
})
  .then(navigateAndExtractStep)
  .then(saveStep)
  .commit();
