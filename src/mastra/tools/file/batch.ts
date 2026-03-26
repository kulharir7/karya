import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export const batchRenameTool = createTool({
  id: "file-batch-rename",
  description:
    "Rename multiple files in a directory with a pattern. " +
    "Use when user wants to bulk rename files, add prefix/suffix, or number files sequentially.",
  inputSchema: z.object({
    dirPath: z.string().describe("Directory containing files to rename"),
    pattern: z.string().optional().describe("File filter pattern (e.g., '*.jpg', '*.pdf'). Default: all files"),
    prefix: z.string().optional().describe("Prefix to add (e.g., 'photo_')"),
    suffix: z.string().optional().describe("Suffix to add before extension (e.g., '_edited')"),
    sequential: z.boolean().optional().describe("Number files sequentially (001, 002, etc.)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    renamed: z.number(),
    info: z.string(),
  }),
  execute: async ({ dirPath, pattern, prefix, suffix, sequential }) => {
    try {
      const resolved = path.resolve(dirPath);
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      const filterExt = pattern?.replace("*", "").toLowerCase() || "";

      let count = 0;
      const files = entries.filter((e) => {
        if (!e.isFile()) return false;
        if (filterExt && !e.name.toLowerCase().endsWith(filterExt)) return false;
        return true;
      });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = path.extname(file.name);
        const base = path.basename(file.name, ext);

        let newName = base;
        if (sequential) {
          newName = String(i + 1).padStart(3, "0");
        }
        if (prefix) newName = prefix + newName;
        if (suffix) newName = newName + suffix;
        newName += ext;

        if (newName !== file.name) {
          fs.renameSync(
            path.join(resolved, file.name),
            path.join(resolved, newName)
          );
          count++;
        }
      }

      return {
        success: true,
        renamed: count,
        info: `Renamed ${count} of ${files.length} files in ${resolved}`,
      };
    } catch (err: any) {
      return {
        success: false,
        renamed: 0,
        info: `Error: ${err.message}`,
      };
    }
  },
});

export const fileSizeTool = createTool({
  id: "file-size-info",
  description:
    "Get detailed size information about a file or folder. " +
    "Shows total size, file count, and breakdown. " +
    "Use when user asks 'how big is this folder' or 'what's the size of this file'.",
  inputSchema: z.object({
    targetPath: z.string().describe("Path to file or folder"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    totalBytes: z.number(),
    totalFormatted: z.string(),
    fileCount: z.number(),
    folderCount: z.number(),
  }),
  execute: async ({ targetPath }) => {
    try {
      const resolved = path.resolve(targetPath);
      const stat = fs.statSync(resolved);

      if (stat.isFile()) {
        return {
          success: true,
          totalBytes: stat.size,
          totalFormatted: formatSize(stat.size),
          fileCount: 1,
          folderCount: 0,
        };
      }

      let totalBytes = 0;
      let fileCount = 0;
      let folderCount = 0;

      function walk(dir: string) {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              folderCount++;
              walk(full);
            } else {
              fileCount++;
              totalBytes += fs.statSync(full).size;
            }
          }
        } catch {}
      }

      walk(resolved);

      return {
        success: true,
        totalBytes,
        totalFormatted: formatSize(totalBytes),
        fileCount,
        folderCount,
      };
    } catch (err: any) {
      return {
        success: false,
        totalBytes: 0,
        totalFormatted: "0 B",
        fileCount: 0,
        folderCount: 0,
      };
    }
  },
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(2) + " GB";
}
