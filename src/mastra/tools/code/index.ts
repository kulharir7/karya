import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export const codeWriteTool = createTool({
  id: "code-write",
  description:
    "Write code to a file. Creates directories if needed. Use for: creating scripts, " +
    "writing programs, generating config files, creating HTML/CSS/JS files. " +
    "Supports any programming language.",
  inputSchema: z.object({
    filePath: z.string().describe("Path for the code file (e.g., 'script.js', 'F:\\projects\\app.py')"),
    code: z.string().describe("The code content to write"),
    language: z.string().optional().describe("Programming language (for syntax info)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string(),
    lines: z.number(),
    size: z.string(),
  }),
  execute: async ({ filePath, code, language }) => {
    try {
      const resolved = path.resolve(filePath);
      const dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(resolved, code, "utf-8");
      const lines = code.split("\n").length;
      const size = fs.statSync(resolved).size;
      return {
        success: true,
        path: resolved,
        lines,
        size: size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`,
      };
    } catch (err: any) {
      return { success: false, path: "", lines: 0, size: `Error: ${err.message}` };
    }
  },
});

export const codeExecuteTool = createTool({
  id: "code-execute",
  description:
    "Execute JavaScript/TypeScript code directly and return the result. " +
    "Use for: calculations, data transformations, generating output, testing logic. " +
    "The code runs in Node.js. Use console.log() for output.",
  inputSchema: z.object({
    code: z.string().describe("JavaScript/TypeScript code to execute"),
    timeout: z.number().optional().describe("Timeout in seconds (default: 10)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
    error: z.string(),
  }),
  execute: async ({ code, timeout }) => {
    try {
      // Write temp file and execute
      const tmpFile = path.join(process.cwd(), `.tmp-exec-${Date.now()}.js`);
      fs.writeFileSync(tmpFile, code, "utf-8");

      try {
        const output = execSync(`node "${tmpFile}"`, {
          encoding: "utf-8",
          timeout: (timeout || 10) * 1000,
          maxBuffer: 1024 * 1024 * 5,
        });
        return { success: true, output: output.slice(0, 10000), error: "" };
      } finally {
        // Cleanup
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    } catch (err: any) {
      return {
        success: false,
        output: err.stdout?.slice(0, 5000) || "",
        error: err.stderr?.slice(0, 5000) || err.message || "Execution failed",
      };
    }
  },
});

export const codeAnalyzeTool = createTool({
  id: "code-analyze",
  description:
    "Analyze a code file — count lines, detect language, list functions/classes, check for issues. " +
    "Use when user asks to review code, understand a file, or check code quality.",
  inputSchema: z.object({
    filePath: z.string().describe("Path to the code file to analyze"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    language: z.string(),
    lines: z.number(),
    size: z.string(),
    functions: z.array(z.string()),
    imports: z.array(z.string()),
    preview: z.string(),
  }),
  execute: async ({ filePath }) => {
    try {
      const resolved = path.resolve(filePath);
      const content = fs.readFileSync(resolved, "utf-8");
      const ext = path.extname(resolved).toLowerCase();
      const lines = content.split("\n");
      const size = fs.statSync(resolved).size;

      const langMap: Record<string, string> = {
        ".js": "JavaScript", ".ts": "TypeScript", ".jsx": "React JSX", ".tsx": "React TSX",
        ".py": "Python", ".rb": "Ruby", ".go": "Go", ".rs": "Rust",
        ".java": "Java", ".cpp": "C++", ".c": "C", ".cs": "C#",
        ".html": "HTML", ".css": "CSS", ".json": "JSON", ".md": "Markdown",
        ".sh": "Shell", ".bat": "Batch", ".ps1": "PowerShell", ".sql": "SQL",
      };

      // Extract functions
      const fnRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>|def\s+(\w+)|class\s+(\w+))/g;
      const functions: string[] = [];
      let match;
      while ((match = fnRegex.exec(content)) !== null) {
        const name = match[1] || match[2] || match[3] || match[4];
        if (name) functions.push(name);
      }

      // Extract imports
      const importRegex = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|from\s+(\S+)\s+import)/g;
      const imports: string[] = [];
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1] || match[2] || match[3]);
      }

      return {
        success: true,
        language: langMap[ext] || ext || "Unknown",
        lines: lines.length,
        size: size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`,
        functions: functions.slice(0, 20),
        imports: imports.slice(0, 20),
        preview: lines.slice(0, 10).join("\n"),
      };
    } catch (err: any) {
      return { success: false, language: "", lines: 0, size: "", functions: [], imports: [], preview: err.message };
    }
  },
});
