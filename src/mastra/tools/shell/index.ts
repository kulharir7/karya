import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { execSync } from "child_process";

export const executeCommandTool = createTool({
  id: "shell-execute",
  description:
    "Execute a shell command on the computer. Use for: running scripts, installing packages, " +
    "git operations, system info, etc. Be careful with destructive commands.",
  inputSchema: z.object({
    command: z.string().describe("The shell command to execute"),
    cwd: z.string().optional().describe("Working directory (optional)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
    exitCode: z.number(),
  }),
  execute: async ({ command, cwd }) => {
    try {
      const output = execSync(command, {
        cwd: cwd || process.cwd(),
        encoding: "utf-8",
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 10,
        shell: "powershell.exe",
      });
      return {
        success: true,
        output: output.slice(0, 10000),
        exitCode: 0,
      };
    } catch (err: any) {
      return {
        success: false,
        output: err.stderr || err.message || "Command failed",
        exitCode: err.status || 1,
      };
    }
  },
});
