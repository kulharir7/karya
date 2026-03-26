import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export const readFileTool = createTool({
  id: "file-read",
  description: "Read the contents of a file. Supports text files (txt, json, csv, md, etc).",
  inputSchema: z.object({
    filePath: z.string().describe("Absolute or relative path to the file to read"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string(),
    size: z.number(),
  }),
  execute: async ({ context }) => {
    const resolved = path.resolve(context.filePath);
    const content = fs.readFileSync(resolved, "utf-8");
    const stats = fs.statSync(resolved);
    return {
      success: true,
      content: content.slice(0, 50000), // Limit to 50KB
      size: stats.size,
    };
  },
});

export const writeFileTool = createTool({
  id: "file-write",
  description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
  inputSchema: z.object({
    filePath: z.string().describe("Path where to write the file"),
    content: z.string().describe("Content to write to the file"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string(),
    size: z.number(),
  }),
  execute: async ({ context }) => {
    const resolved = path.resolve(context.filePath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, context.content, "utf-8");
    const stats = fs.statSync(resolved);
    return {
      success: true,
      path: resolved,
      size: stats.size,
    };
  },
});

export const listFilesTool = createTool({
  id: "file-list",
  description: "List files and folders in a directory.",
  inputSchema: z.object({
    dirPath: z.string().describe("Path to the directory to list"),
    recursive: z.boolean().optional().describe("Whether to list recursively (default: false)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    files: z.array(z.string()),
    count: z.number(),
  }),
  execute: async ({ context }) => {
    const resolved = path.resolve(context.dirPath);
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const files = entries.map((e) => {
      const prefix = e.isDirectory() ? "📁 " : "📄 ";
      return prefix + e.name;
    });
    return {
      success: true,
      files,
      count: files.length,
    };
  },
});

export const moveFileTool = createTool({
  id: "file-move",
  description: "Move or rename a file or folder.",
  inputSchema: z.object({
    source: z.string().describe("Current path of the file/folder"),
    destination: z.string().describe("New path for the file/folder"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    from: z.string(),
    to: z.string(),
  }),
  execute: async ({ context }) => {
    const src = path.resolve(context.source);
    const dest = path.resolve(context.destination);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.renameSync(src, dest);
    return {
      success: true,
      from: src,
      to: dest,
    };
  },
});

export const searchFilesTool = createTool({
  id: "file-search",
  description: "Search for files by name pattern in a directory.",
  inputSchema: z.object({
    dirPath: z.string().describe("Directory to search in"),
    pattern: z.string().describe("File name pattern to search for (e.g., '*.pdf', 'invoice')"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    matches: z.array(z.string()),
    count: z.number(),
  }),
  execute: async ({ context }) => {
    const resolved = path.resolve(context.dirPath);
    const matches: string[] = [];
    const searchPattern = context.pattern.toLowerCase().replace(/\*/g, "");

    function walk(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.name.toLowerCase().includes(searchPattern)) {
          matches.push(fullPath);
        }
      }
    }

    walk(resolved);
    return {
      success: true,
      matches: matches.slice(0, 100),
      count: matches.length,
    };
  },
});
