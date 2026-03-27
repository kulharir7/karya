/**
 * File Organizer Workflow
 * 
 * Demonstrates: Sequential step execution
 * 
 * Steps:
 * 1. List all files in source directory
 * 2. Categorize files by extension
 * 3. Move files to category folders
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Default category rules
const DEFAULT_CATEGORIES: Record<string, string[]> = {
  images: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"],
  documents: [".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".xls", ".xlsx", ".ppt", ".pptx"],
  videos: [".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm"],
  audio: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".m4a"],
  archives: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"],
  code: [".js", ".ts", ".py", ".java", ".cpp", ".c", ".h", ".css", ".html", ".json", ".xml", ".md"],
  executables: [".exe", ".msi", ".dmg", ".app", ".bat", ".sh"],
};

// Step 1: List and categorize files
const listAndCategorizeStep = createStep({
  id: "list-and-categorize",
  inputSchema: z.object({
    sourcePath: z.string(),
    rules: z.record(z.string(), z.array(z.string())).optional(),
  }),
  outputSchema: z.object({
    sourcePath: z.string(),
    files: z.array(z.object({
      name: z.string(),
      path: z.string(),
      extension: z.string(),
      size: z.number(),
      category: z.string(),
    })),
    totalFiles: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { sourcePath, rules } = inputData;
    const categoryRules = rules || DEFAULT_CATEGORIES;
    
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source path does not exist: ${sourcePath}`);
    }
    
    const items = fs.readdirSync(sourcePath, { withFileTypes: true });
    const files: Array<{
      name: string;
      path: string;
      extension: string;
      size: number;
      category: string;
    }> = [];
    
    for (const item of items) {
      if (item.isFile()) {
        const filePath = path.join(sourcePath, item.name);
        const ext = path.extname(item.name).toLowerCase();
        const stats = fs.statSync(filePath);
        
        // Determine category
        let category = "other";
        for (const [cat, extensions] of Object.entries(categoryRules)) {
          if (extensions.includes(ext)) {
            category = cat;
            break;
          }
        }
        
        files.push({
          name: item.name,
          path: filePath,
          extension: ext,
          size: stats.size,
          category,
        });
      }
    }
    
    return {
      sourcePath,
      files,
      totalFiles: files.length,
    };
  },
});

// Step 2: Organize (move files to category folders)
const organizeStep = createStep({
  id: "organize",
  inputSchema: z.object({
    sourcePath: z.string(),
    files: z.array(z.object({
      name: z.string(),
      path: z.string(),
      extension: z.string(),
      size: z.number(),
      category: z.string(),
    })),
    totalFiles: z.number(),
  }),
  outputSchema: z.object({
    organized: z.array(z.object({
      file: z.string(),
      from: z.string(),
      to: z.string(),
      category: z.string(),
    })),
    skipped: z.array(z.string()),
    summary: z.record(z.string(), z.number()),
  }),
  execute: async ({ inputData }) => {
    const { sourcePath, files } = inputData;
    
    const organized: Array<{ file: string; from: string; to: string; category: string }> = [];
    const skipped: string[] = [];
    const summary: Record<string, number> = {};
    
    for (const file of files) {
      // Create category folder if needed
      const categoryFolder = path.join(sourcePath, file.category);
      if (!fs.existsSync(categoryFolder)) {
        fs.mkdirSync(categoryFolder, { recursive: true });
      }
      
      const destPath = path.join(categoryFolder, file.name);
      
      // Check if destination exists
      if (fs.existsSync(destPath)) {
        skipped.push(file.name);
        continue;
      }
      
      // Move file
      fs.renameSync(file.path, destPath);
      
      organized.push({
        file: file.name,
        from: file.path,
        to: destPath,
        category: file.category,
      });
      
      summary[file.category] = (summary[file.category] || 0) + 1;
    }
    
    return {
      organized,
      skipped,
      summary,
    };
  },
});

// Create the workflow
export const fileOrganizerWorkflow = createWorkflow({
  id: "file-organizer",
  inputSchema: z.object({
    sourcePath: z.string(),
    rules: z.record(z.string(), z.array(z.string())).optional(),
  }),
  outputSchema: z.object({
    organized: z.array(z.object({
      file: z.string(),
      from: z.string(),
      to: z.string(),
      category: z.string(),
    })),
    skipped: z.array(z.string()),
    summary: z.record(z.string(), z.number()),
  }),
})
  .then(listAndCategorizeStep)
  .then(organizeStep)
  .commit();
