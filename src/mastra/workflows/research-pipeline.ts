/**
 * Research Pipeline Workflow
 * 
 * Demonstrates: Sequential research steps
 * 
 * Steps:
 * 1. Search web for query
 * 2. Process top sources
 * 3. Synthesize findings
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Step 1: Search and gather sources
const searchStep = createStep({
  id: "search-sources",
  inputSchema: z.object({
    query: z.string(),
    sources: z.number().optional().default(5),
    depth: z.enum(["shallow", "medium", "deep"]).optional().default("medium"),
  }),
  outputSchema: z.object({
    query: z.string(),
    depth: z.string(),
    results: z.array(z.object({
      url: z.string(),
      title: z.string(),
      snippet: z.string(),
    })),
    searchedAt: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { query, sources = 5, depth = "medium" } = inputData;
    
    // Simulate web search results (in real use, this would call web-search tool)
    // For now, return placeholder results
    const results = [
      {
        url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        title: `Results for: ${query}`,
        snippet: `Information about ${query}...`,
      },
    ];
    
    return {
      query,
      depth: depth || "medium",
      results,
      searchedAt: Date.now(),
    };
  },
});

// Step 2: Synthesize findings
const synthesizeStep = createStep({
  id: "synthesize",
  inputSchema: z.object({
    query: z.string(),
    depth: z.string(),
    results: z.array(z.object({
      url: z.string(),
      title: z.string(),
      snippet: z.string(),
    })),
    searchedAt: z.number(),
  }),
  outputSchema: z.object({
    query: z.string(),
    summary: z.string(),
    keyFindings: z.array(z.string()),
    sources: z.array(z.object({
      url: z.string(),
      title: z.string(),
      contribution: z.string(),
    })),
    confidence: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { query, results, depth } = inputData;
    
    // Synthesize findings
    const keyFindings = results.map((r) => r.snippet).filter(Boolean);
    
    const summary = `Research findings for: "${query}"

${keyFindings.length} key points identified from ${results.length} sources.
Depth: ${depth}

${keyFindings.join("\n\n")}`;
    
    const confidence = Math.min(100, results.length * 20);
    
    return {
      query,
      summary,
      keyFindings,
      sources: results.map((r) => ({
        url: r.url,
        title: r.title,
        contribution: r.snippet,
      })),
      confidence,
    };
  },
});

// Create the workflow
export const researchPipelineWorkflow = createWorkflow({
  id: "research-pipeline",
  inputSchema: z.object({
    query: z.string(),
    sources: z.number().optional(),
    depth: z.enum(["shallow", "medium", "deep"]).optional(),
  }),
  outputSchema: z.object({
    query: z.string(),
    summary: z.string(),
    keyFindings: z.array(z.string()),
    sources: z.array(z.object({
      url: z.string(),
      title: z.string(),
      contribution: z.string(),
    })),
    confidence: z.number(),
  }),
})
  .then(searchStep)
  .then(synthesizeStep)
  .commit();
