/**
 * Git Tools — Point 48
 * 
 * Git operations from within the agent.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { execSync } from "child_process";
import { fullSecurityCheck } from "../../../lib/security-engine";

function runGit(args: string, cwd: string): { success: boolean; output: string } {
  try {
    const output = execSync(`git ${args}`, { cwd, encoding: "utf-8", timeout: 30000 }).trim();
    return { success: true, output };
  } catch (err: any) {
    return { success: false, output: err.stderr?.trim() || err.message };
  }
}

export const gitStatusTool = createTool({
  id: "git-status",
  description: "Check git status of a repository. Shows modified, staged, and untracked files.",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    branch: z.string(),
    status: z.string(),
    summary: z.string(),
  }),
  execute: async ({ path: repoPath }) => {
    const branch = runGit("branch --show-current", repoPath);
    const status = runGit("status --short", repoPath);
    const lines = status.output.split("\n").filter(Boolean);
    const modified = lines.filter(l => l.startsWith(" M") || l.startsWith("M ")).length;
    const added = lines.filter(l => l.startsWith("A ") || l.startsWith("??")).length;
    const deleted = lines.filter(l => l.startsWith("D ") || l.startsWith(" D")).length;

    return {
      success: status.success,
      branch: branch.output || "unknown",
      status: status.output || "Clean — nothing to commit",
      summary: `Branch: ${branch.output} | ${modified} modified, ${added} new, ${deleted} deleted`,
    };
  },
});

export const gitCommitTool = createTool({
  id: "git-commit",
  description: "Stage all changes and create a git commit. ALWAYS confirm with user before committing.",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository"),
    message: z.string().describe("Commit message"),
    addAll: z.boolean().optional().describe("Stage all changes before committing (default: true)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
  }),
  execute: async ({ path: repoPath, message, addAll }) => {
    if (addAll !== false) {
      runGit("add -A", repoPath);
    }
    const result = runGit(`commit -m "${message.replace(/"/g, '\\"')}"`, repoPath);
    return result;
  },
});

export const gitPushTool = createTool({
  id: "git-push",
  description: "Push commits to remote repository. ALWAYS confirm with user before pushing.",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository"),
    remote: z.string().optional().describe("Remote name (default: origin)"),
    branch: z.string().optional().describe("Branch name (default: current branch)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
  }),
  execute: async ({ path: repoPath, remote, branch }) => {
    const check = fullSecurityCheck("git-push", { command: `git push ${remote || "origin"} ${branch || ""}` });
    if (!check.allowed) {
      return { success: false, output: `🔒 BLOCKED: ${check.reason}` };
    }
    const r = remote || "origin";
    const b = branch || runGit("branch --show-current", repoPath).output || "main";
    return runGit(`push ${r} ${b}`, repoPath);
  },
});

export const gitLogTool = createTool({
  id: "git-log",
  description: "Show recent git commit history.",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository"),
    count: z.number().optional().describe("Number of commits to show (default: 10)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
  }),
  execute: async ({ path: repoPath, count }) => {
    return runGit(`log --oneline -${count || 10}`, repoPath);
  },
});

export const gitDiffTool = createTool({
  id: "git-diff",
  description: "Show git diff — what changed in the working directory.",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository"),
    file: z.string().optional().describe("Specific file to diff (optional)"),
    staged: z.boolean().optional().describe("Show staged changes instead"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
  }),
  execute: async ({ path: repoPath, file, staged }) => {
    const args = `diff ${staged ? "--staged" : ""} ${file || ""}`.trim();
    return runGit(args, repoPath);
  },
});
