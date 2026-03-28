/**
 * Web Scraper Workflow
 * 
 * Sequential workflow: Navigate → Extract → Save
 * Uses fetch with fallback (Stagehand optional)
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
    method: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { url, outputPath, selector } = inputData;
    
    // Fetch-based approach (works for most sites)
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      const html = await response.text();
      
      // Extract title
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1] : "Untitled";
      
      // Extract content (simple text extraction)
      const content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50000);
      
      return {
        url,
        outputPath,
        pageTitle,
        content,
        extractedAt: Date.now(),
        method: "fetch",
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
    method: z.string(),
  }),
  outputSchema: z.object({
    savedPath: z.string(),
    bytesWritten: z.number(),
    pageTitle: z.string(),
    method: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { outputPath, pageTitle, content, extractedAt, url, method } = inputData;
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Format content with metadata
    const formattedContent = `# ${pageTitle}

**Source:** ${url}
**Extracted at:** ${new Date(extractedAt).toISOString()}
**Method:** ${method}

---

${content}
`;
    
    fs.writeFileSync(outputPath, formattedContent, "utf-8");
    
    return {
      savedPath: outputPath,
      bytesWritten: Buffer.byteLength(formattedContent),
      pageTitle,
      method,
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
    method: z.string(),
  }),
})
  .then(navigateAndExtractStep)
  .then(saveStep)
  .commit();
