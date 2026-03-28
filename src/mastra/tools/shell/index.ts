import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { execSync } from "child_process";
import { fullSecurityCheck, getSecurityConfig } from "../../../lib/security-engine";

export const executeCommandTool = createTool({
  id: "shell-execute",
  description:
    "Execute a shell command on the computer. Use for: running scripts, installing packages, " +
    "git operations, system info, etc. Dangerous commands (format, rm -rf /, etc.) are blocked by security policy.",
  inputSchema: z.object({
    command: z.string().describe("The shell command to execute"),
    cwd: z.string().optional().describe("Working directory (optional)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
    exitCode: z.number(),
    blocked: z.boolean().optional(),
  }),
  execute: async ({ command, cwd }) => {
    // ---- SECURITY CHECK ----
    const check = fullSecurityCheck("shell-execute", { command });
    if (!check.allowed) {
      return {
        success: false,
        output: `🔒 BLOCKED: ${check.reason}`,
        exitCode: -1,
        blocked: true,
      };
    }

    // ---- EXECUTE ----
    try {
      const cfg = getSecurityConfig();
      const timeout = (cfg.maxShellTimeoutSeconds || 60) * 1000;

      const output = execSync(command, {
        cwd: cwd || process.cwd(),
        encoding: "utf-8",
        timeout,
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
