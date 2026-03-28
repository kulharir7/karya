/**
 * Shell Tools — REMOVED
 * 
 * Shell execution is now handled by Mastra Workspace (LocalSandbox) automatically.
 * Mastra provides: sandbox_exec with background process support.
 * 
 * The old executeCommandTool used execSync with security checks.
 * Mastra's sandbox has its own safety mechanisms.
 */

// Kept as empty export for backward compatibility
// If any file still imports executeCommandTool, it won't break
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Placeholder — Mastra Workspace sandbox_exec is the real tool now
export const executeCommandTool = createTool({
  id: "shell-execute-legacy",
  description: "DEPRECATED: Use Mastra workspace sandbox instead. This tool is kept for backward compatibility.",
  inputSchema: z.object({
    command: z.string().describe("Shell command"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
  }),
  execute: async ({ command }) => {
    return {
      success: false,
      output: "This tool is deprecated. Mastra Workspace sandbox handles shell execution now.",
    };
  },
});
