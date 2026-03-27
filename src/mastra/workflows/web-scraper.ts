/**
 * Web Scraper Workflow
 * 
 * Sequential workflow: Navigate → Extract → Save
 * Uses Stagehand for JavaScript-rendered pages
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { getStagehand, closeStagehand } from "@/lib/stagehand";

// Step 1: Navigate and extract using Stagehand
const navigateAndExtractStep = createStep({
  id: "navigate-extract",
  inputSchema: z.object({
    url: z.string(),
    outputPath: z.string(),
    selector: z.string().optional(),
    waitForSelector: z.string().optional(),
    useStagehand: z.boolean().optional().default(true),
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
    const { url, outputPath, selector, waitForSelector, useStagehand = true } = inputData;
    
    // Try Stagehand first for JS-rendered content
    if (useStagehand) {
      try {
        const stagehand = await getStagehand();
        const page = stagehand.page;
        
        // Navigate with timeout
        await page.goto(url, { 
          waitUntil: "networkidle",
          timeout: 30000 
        });
        
        // Wait for specific selector if provided
        if (waitForSelector) {
          await page.waitForSelector(waitForSelector, { timeout: 10000 });
        }
        
        // Extract page title
        const pageTitle = await page.title() || "Untitled";
        
        // Extract content
        let content: string;
        if (selector) {
          // Extract specific element
          const extracted = await stagehand.extract({
            instruction: `Extract all text content from the element matching: ${selector}`,
            schema: z.object({
              text: z.string(),
            }),
          });
          content = extracted.text || "";
        } else {
          // Extract main content using Stagehand's AI
          const extracted = await stagehand.extract({
            instruction: "Extract the main article or page content as clean text. Remove navigation, ads, and boilerplate.",
            schema: z.object({
              title: z.string().optional(),
              content: z.string(),
              author: z.string().optional(),
              date: z.string().optional(),
            }),
          });
          content = extracted.content || "";
        }
        
        return {
          url,
          outputPath,
          pageTitle,
          content: content.slice(0, 50000), // Limit to 50KB
          extractedAt: Date.now(),
          method: "stagehand",
        };
      } catch (stagehandError) {
        console.warn("[web-scraper] Stagehand failed, falling back to fetch:", stagehandError);
        // Fall through to fetch-based approach
      }
    }
    
    // Fallback: Simple fetch (for static pages or when Stagehand fails)
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
    waitForSelector: z.string().optional(),
    useStagehand: z.boolean().optional(),
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
