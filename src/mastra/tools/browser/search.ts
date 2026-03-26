import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const webSearchTool = createTool({
  id: "web-search",
  description:
    "Search the web using DuckDuckGo. Use this when the user wants to search for information, " +
    "find websites, look up facts, or research anything online. Returns titles, URLs, and snippets.",
  inputSchema: z.object({
    query: z.string().describe("The search query (e.g., 'best restaurants in Delhi', 'Mastra AI framework')"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      })
    ),
    count: z.number(),
  }),
  execute: async ({ query }) => {
    try {
      // Use DuckDuckGo HTML search (no API key needed)
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      const html = await res.text();

      // Parse results from HTML
      const results: { title: string; url: string; snippet: string }[] = [];
      const resultRegex =
        /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/g;

      let match;
      while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
        const rawUrl = match[1];
        const title = match[2].replace(/<[^>]*>/g, "").trim();
        const snippet = match[3].replace(/<[^>]*>/g, "").trim();

        // DuckDuckGo wraps URLs in redirect
        let cleanUrl = rawUrl;
        const uddg = rawUrl.match(/uddg=([^&]*)/);
        if (uddg) cleanUrl = decodeURIComponent(uddg[1]);

        if (title && cleanUrl) {
          results.push({ title, url: cleanUrl, snippet });
        }
      }

      // Fallback: simpler regex if above didn't match
      if (results.length === 0) {
        const simpleRegex = /<a[^>]*class="result__a"[^>]*>(.*?)<\/a>/g;
        let simpleMatch;
        while ((simpleMatch = simpleRegex.exec(html)) !== null && results.length < 5) {
          const title = simpleMatch[1].replace(/<[^>]*>/g, "").trim();
          if (title) {
            results.push({ title, url: "", snippet: "" });
          }
        }
      }

      return {
        success: true,
        results,
        count: results.length,
      };
    } catch (err: any) {
      return {
        success: false,
        results: [{ title: "Search failed", url: "", snippet: err.message }],
        count: 0,
      };
    }
  },
});
