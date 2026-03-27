/**
 * Error Recovery Tools — Point 7
 * 
 * When a tool fails, agent can use these to find alternative approaches.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const errorHistory: { tool: string; error: string; timestamp: number; recovered: boolean }[] = [];

/**
 * suggest-recovery — When a tool fails, get alternative approaches
 */
export const suggestRecoveryTool = createTool({
  id: "suggest-recovery",
  description: `When a tool call fails, use this to get alternative approaches. 
Provide the failed tool name and error message, and get suggestions for how to accomplish the same task differently.
ALWAYS use this when a tool fails instead of giving up.`,
  inputSchema: z.object({
    failedTool: z.string().describe("The tool that failed (e.g. 'code-write', 'browser-navigate')"),
    error: z.string().describe("The error message"),
    task: z.string().describe("What you were trying to accomplish"),
  }),
  outputSchema: z.object({
    alternatives: z.array(z.object({
      approach: z.string(),
      tool: z.string(),
      confidence: z.number(),
    })),
    suggestion: z.string(),
    shouldRetry: z.boolean(),
    retryHint: z.string().optional(),
  }),
  execute: async ({ failedTool, error, task }) => {
    errorHistory.push({ tool: failedTool, error, timestamp: Date.now(), recovered: false });
    if (errorHistory.length > 50) errorHistory.splice(0, errorHistory.length - 50);

    const errorLower = error.toLowerCase();
    const alternatives: { approach: string; tool: string; confidence: number }[] = [];
    let shouldRetry = false;
    let retryHint: string | undefined;

    // Browser failures
    if (failedTool.includes("browser") || failedTool.includes("navigate")) {
      if (errorLower.includes("timeout") || errorLower.includes("navigation")) {
        shouldRetry = true;
        retryHint = "Page might be slow — try again or use a different URL";
        alternatives.push(
          { approach: "Use web-search to find an alternative URL", tool: "web-search", confidence: 0.8 },
          { approach: "Use shell-execute with curl to fetch directly", tool: "shell-execute", confidence: 0.7 },
        );
      }
      if (errorLower.includes("not found") || errorLower.includes("404")) {
        alternatives.push(
          { approach: "Search for the content using web-search", tool: "web-search", confidence: 0.9 },
        );
      }
      if (errorLower.includes("blocked") || errorLower.includes("captcha")) {
        alternatives.push(
          { approach: "Use API if available (api-call tool)", tool: "api-call", confidence: 0.7 },
          { approach: "Try web-search for the same information", tool: "web-search", confidence: 0.8 },
        );
      }
    }

    // File failures
    if (failedTool.includes("file") || failedTool.includes("read") || failedTool.includes("write")) {
      if (errorLower.includes("permission") || errorLower.includes("access")) {
        alternatives.push(
          { approach: "Write to a different location (Desktop/Downloads)", tool: "file-write", confidence: 0.9 },
          { approach: "Use shell-execute with elevated permissions", tool: "shell-execute", confidence: 0.7 },
        );
      }
      if (errorLower.includes("not found") || errorLower.includes("enoent")) {
        alternatives.push(
          { approach: "Search for the file using file-search", tool: "file-search", confidence: 0.9 },
          { approach: "List parent directory to find correct name", tool: "file-list", confidence: 0.85 },
        );
      }
    }

    // Code/Shell failures
    if (failedTool.includes("code") || failedTool.includes("shell") || failedTool.includes("execute")) {
      if (errorLower.includes("not found") || errorLower.includes("not recognized")) {
        alternatives.push(
          { approach: "Check if the command/package is installed", tool: "shell-execute", confidence: 0.8 },
        );
      }
      if (errorLower.includes("syntax") || errorLower.includes("parse")) {
        shouldRetry = true;
        retryHint = "Fix the syntax error and retry";
        alternatives.push(
          { approach: "Analyze the code first, then fix and rewrite", tool: "code-analyze", confidence: 0.9 },
        );
      }
    }

    // API failures
    if (failedTool.includes("api")) {
      if (errorLower.includes("429") || errorLower.includes("rate limit")) {
        shouldRetry = true;
        retryHint = "Wait 30 seconds and retry — rate limit hit";
      }
      if (errorLower.includes("500") || errorLower.includes("server error")) {
        shouldRetry = true;
        retryHint = "Server error — retry in a moment";
      }
    }

    // Generic fallbacks
    if (alternatives.length === 0) {
      alternatives.push(
        { approach: "Try a completely different approach", tool: "shell-execute", confidence: 0.5 },
        { approach: "Search for a solution online", tool: "web-search", confidence: 0.6 },
      );
    }

    alternatives.sort((a, b) => b.confidence - a.confidence);

    const suggestion = shouldRetry
      ? `🔄 Retry recommended: ${retryHint}. If that fails, try: ${alternatives[0]?.approach}`
      : `💡 Best alternative: ${alternatives[0]?.approach} (using ${alternatives[0]?.tool})`;

    return {
      alternatives: alternatives.slice(0, 4),
      suggestion,
      shouldRetry,
      retryHint,
    };
  },
});

/**
 * log-recovery — Record that a recovery was successful
 */
export const logRecoveryTool = createTool({
  id: "log-recovery",
  description: "Record a successful recovery after a tool failure. Helps track which recovery strategies work.",
  inputSchema: z.object({
    originalTool: z.string().describe("The tool that originally failed"),
    recoveryTool: z.string().describe("The tool/approach that worked"),
    summary: z.string().describe("Brief summary of what happened"),
  }),
  outputSchema: z.object({
    logged: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ originalTool, recoveryTool, summary }) => {
    const recent = errorHistory
      .filter(e => e.tool === originalTool && !e.recovered)
      .pop();
    if (recent) {
      recent.recovered = true;
    }

    return {
      logged: true,
      message: `✅ Recovery logged: ${originalTool} → ${recoveryTool}. ${summary}`,
    };
  },
});
