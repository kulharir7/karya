/**
 * Multi-Source Research Workflow
 * 
 * Demonstrates: .parallel() execution
 * 
 * Steps:
 * 1. Receive query
 * 2. PARALLEL: Search multiple sources simultaneously
 *    - Web search
 *    - Wikipedia search
 *    - News search
 * 3. Merge and synthesize results
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Common output schema for all search steps
const searchResultSchema = z.object({
  source: z.string(),
  query: z.string(),
  results: z.array(z.object({
    title: z.string(),
    snippet: z.string(),
    url: z.string().optional(),
  })),
  success: z.boolean(),
  error: z.string().optional(),
});

// Step 1: Prepare query for parallel execution
const prepareQueryStep = createStep({
  id: "prepare-query",
  inputSchema: z.object({
    query: z.string(),
    maxResultsPerSource: z.number().optional().default(5),
  }),
  outputSchema: z.object({
    query: z.string(),
    maxResults: z.number(),
    timestamp: z.number(),
  }),
  execute: async ({ inputData }) => {
    return {
      query: inputData.query,
      maxResults: inputData.maxResultsPerSource || 5,
      timestamp: Date.now(),
    };
  },
});

// Step 2a: Web Search (DuckDuckGo)
const webSearchStep = createStep({
  id: "web-search",
  inputSchema: z.object({
    query: z.string(),
    maxResults: z.number(),
    timestamp: z.number(),
  }),
  outputSchema: searchResultSchema,
  execute: async ({ inputData }) => {
    const { query, maxResults } = inputData;
    
    try {
      // DuckDuckGo instant answer API
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const results: { title: string; snippet: string; url?: string }[] = [];
      
      // Abstract (main result)
      if (data.Abstract) {
        results.push({
          title: data.Heading || query,
          snippet: data.Abstract,
          url: data.AbstractURL,
        });
      }
      
      // Related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, maxResults - 1)) {
          if (topic.Text) {
            results.push({
              title: topic.FirstURL?.split("/").pop() || "Related",
              snippet: topic.Text,
              url: topic.FirstURL,
            });
          }
        }
      }
      
      return {
        source: "DuckDuckGo",
        query,
        results: results.slice(0, maxResults),
        success: true,
      };
    } catch (err: any) {
      return {
        source: "DuckDuckGo",
        query,
        results: [],
        success: false,
        error: err.message,
      };
    }
  },
});

// Step 2b: Wikipedia Search
const wikipediaSearchStep = createStep({
  id: "wikipedia-search",
  inputSchema: z.object({
    query: z.string(),
    maxResults: z.number(),
    timestamp: z.number(),
  }),
  outputSchema: searchResultSchema,
  execute: async ({ inputData }) => {
    const { query, maxResults } = inputData;
    
    try {
      // Wikipedia API
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${maxResults}&format=json&origin=*`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const results = (data.query?.search || []).map((item: any) => ({
        title: item.title,
        snippet: item.snippet.replace(/<[^>]*>/g, ""), // Strip HTML
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
      }));
      
      return {
        source: "Wikipedia",
        query,
        results,
        success: true,
      };
    } catch (err: any) {
      return {
        source: "Wikipedia",
        query,
        results: [],
        success: false,
        error: err.message,
      };
    }
  },
});

// Step 2c: News Search (via DuckDuckGo News)
const newsSearchStep = createStep({
  id: "news-search",
  inputSchema: z.object({
    query: z.string(),
    maxResults: z.number(),
    timestamp: z.number(),
  }),
  outputSchema: searchResultSchema,
  execute: async ({ inputData }) => {
    const { query, maxResults } = inputData;
    
    try {
      // Using a public news API or fallback
      // Note: In production, use a real news API like NewsAPI, Google News, etc.
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query + " news")}&format=json&no_html=1`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const results: { title: string; snippet: string; url?: string }[] = [];
      
      // Try to get news-like results from related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, maxResults)) {
          if (topic.Text) {
            results.push({
              title: "News: " + (topic.FirstURL?.split("/").pop() || query),
              snippet: topic.Text,
              url: topic.FirstURL,
            });
          }
        }
      }
      
      // If no results, indicate that
      if (results.length === 0 && data.Abstract) {
        results.push({
          title: "Latest on " + query,
          snippet: data.Abstract,
          url: data.AbstractURL,
        });
      }
      
      return {
        source: "News",
        query,
        results: results.slice(0, maxResults),
        success: results.length > 0,
        error: results.length === 0 ? "No news results found" : undefined,
      };
    } catch (err: any) {
      return {
        source: "News",
        query,
        results: [],
        success: false,
        error: err.message,
      };
    }
  },
});

// Step 3: Merge and synthesize all results
const synthesizeResultsStep = createStep({
  id: "synthesize-results",
  inputSchema: z.object({
    "web-search": searchResultSchema,
    "wikipedia-search": searchResultSchema,
    "news-search": searchResultSchema,
  }),
  outputSchema: z.object({
    query: z.string(),
    totalResults: z.number(),
    sourcesSummary: z.array(z.object({
      source: z.string(),
      count: z.number(),
      success: z.boolean(),
    })),
    allResults: z.array(z.object({
      source: z.string(),
      title: z.string(),
      snippet: z.string(),
      url: z.string().optional(),
    })),
    synthesis: z.string(),
    executionTime: z.string(),
  }),
  execute: async ({ inputData }) => {
    const webResults = inputData["web-search"];
    const wikiResults = inputData["wikipedia-search"];
    const newsResults = inputData["news-search"];
    
    // Combine all results
    const allResults: { source: string; title: string; snippet: string; url?: string }[] = [];
    
    for (const result of webResults.results) {
      allResults.push({ source: "Web", ...result });
    }
    for (const result of wikiResults.results) {
      allResults.push({ source: "Wikipedia", ...result });
    }
    for (const result of newsResults.results) {
      allResults.push({ source: "News", ...result });
    }
    
    // Create summary
    const sourcesSummary = [
      { source: "Web (DuckDuckGo)", count: webResults.results.length, success: webResults.success },
      { source: "Wikipedia", count: wikiResults.results.length, success: wikiResults.success },
      { source: "News", count: newsResults.results.length, success: newsResults.success },
    ];
    
    // Generate synthesis
    const successfulSources = sourcesSummary.filter(s => s.success).map(s => s.source);
    const totalResults = allResults.length;
    
    let synthesis = `## Research Summary: "${webResults.query}"\n\n`;
    synthesis += `**Sources queried:** ${sourcesSummary.length} (${successfulSources.length} successful)\n`;
    synthesis += `**Total results:** ${totalResults}\n\n`;
    
    if (wikiResults.results.length > 0) {
      synthesis += `### Wikipedia\n${wikiResults.results[0].snippet}\n\n`;
    }
    
    if (webResults.results.length > 0) {
      synthesis += `### Web Search\n${webResults.results.map(r => `- ${r.title}: ${r.snippet.slice(0, 100)}...`).join("\n")}\n\n`;
    }
    
    if (newsResults.results.length > 0) {
      synthesis += `### News\n${newsResults.results.map(r => `- ${r.snippet.slice(0, 100)}...`).join("\n")}\n`;
    }
    
    return {
      query: webResults.query,
      totalResults,
      sourcesSummary,
      allResults,
      synthesis,
      executionTime: "parallel",
    };
  },
});

// Create the workflow with PARALLEL execution
export const multiSourceResearchWorkflow = createWorkflow({
  id: "multi-source-research",
  inputSchema: z.object({
    query: z.string(),
    maxResultsPerSource: z.number().optional(),
  }),
  outputSchema: z.object({
    query: z.string(),
    totalResults: z.number(),
    sourcesSummary: z.array(z.object({
      source: z.string(),
      count: z.number(),
      success: z.boolean(),
    })),
    allResults: z.array(z.object({
      source: z.string(),
      title: z.string(),
      snippet: z.string(),
      url: z.string().optional(),
    })),
    synthesis: z.string(),
    executionTime: z.string(),
  }),
})
  .then(prepareQueryStep)
  // PARALLEL: All three searches run SIMULTANEOUSLY
  .parallel([webSearchStep, wikipediaSearchStep, newsSearchStep])
  // Merge results from all parallel branches
  .then(synthesizeResultsStep)
  .commit();
