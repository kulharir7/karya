/**
 * Backup Manager Workflow
 * 
 * Demonstrates: Sequential backup process
 * 
 * Steps:
 * 1. Collect files from source paths
 * 2. Create archive
 * 3. Generate summary
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";

// Helper function
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Step 1: Collect files
const collectFilesStep = createStep({
  id: "collect-files",
  inputSchema: z.object({
    sourcePaths: z.array(z.string()),
    backupPath: z.string(),
  }),
  outputSchema: z.object({
    backupPath: z.string(),
    archiveName: z.string(),
    files: z.array(z.object({
      path: z.string(),
      name: z.string(),
      size: z.number(),
    })),
    totalSize: z.number(),
    fileCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { sourcePaths, backupPath } = inputData;
    const files: Array<{ path: string; name: string; size: number }> = [];
    let totalSize = 0;
    
    for (const sourcePath of sourcePaths) {
      if (fs.existsSync(sourcePath)) {
        const stats = fs.statSync(sourcePath);
        
        if (stats.isFile()) {
          files.push({
            path: sourcePath,
            name: path.basename(sourcePath),
            size: stats.size,
          });
          totalSize += stats.size;
        } else if (stats.isDirectory()) {
          // Recursively collect files from directory
          const collectDir = (dirPath: string) => {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const item of items) {
              const fullPath = path.join(dirPath, item.name);
              if (item.isFile()) {
                const fileStats = fs.statSync(fullPath);
                files.push({
                  path: fullPath,
                  name: path.relative(sourcePath, fullPath),
                  size: fileStats.size,
                });
                totalSize += fileStats.size;
              } else if (item.isDirectory()) {
                collectDir(fullPath);
              }
            }
          };
          collectDir(sourcePath);
        }
      }
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archiveName = `backup-${timestamp}.zip`;
    
    return {
      backupPath,
      archiveName,
      files,
      totalSize,
      fileCount: files.length,
    };
  },
});

// Step 2: Create archive
const createArchiveStep = createStep({
  id: "create-archive",
  inputSchema: z.object({
    backupPath: z.string(),
    archiveName: z.string(),
    files: z.array(z.object({
      path: z.string(),
      name: z.string(),
      size: z.number(),
    })),
    totalSize: z.number(),
    fileCount: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    archivePath: z.string(),
    archiveSize: z.number(),
    archiveSizeFormatted: z.string(),
    filesArchived: z.number(),
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { backupPath, archiveName, files } = inputData;
    
    // Ensure backup directory exists
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }
    
    const archivePath = path.join(backupPath, archiveName);
    
    // Create zip archive
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      output.on("close", () => {
        const archiveSize = archive.pointer();
        const summary = `✅ Backup completed successfully!

**Archive:** ${archivePath}
**Size:** ${formatSize(archiveSize)}
**Files:** ${files.length} files archived
**Created:** ${new Date().toISOString()}`;
        
        resolve({
          success: true,
          archivePath,
          archiveSize,
          archiveSizeFormatted: formatSize(archiveSize),
          filesArchived: files.length,
          summary,
        });
      });
      
      archive.on("error", reject);
      archive.pipe(output);
      
      // Add files to archive
      for (const file of files) {
        archive.file(file.path, { name: file.name });
      }
      
      archive.finalize();
    });
  },
});

// Create the workflow
export const backupWorkflow = createWorkflow({
  id: "backup",
  inputSchema: z.object({
    sourcePaths: z.array(z.string()),
    backupPath: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    archivePath: z.string(),
    archiveSize: z.number(),
    archiveSizeFormatted: z.string(),
    filesArchived: z.number(),
    summary: z.string(),
  }),
})
  .then(collectFilesStep)
  .then(createArchiveStep)
  .commit();
