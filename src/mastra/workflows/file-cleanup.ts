/**
 * File Cleanup Workflow
 * 
 * Demonstrates: suspend() and resume() — Human-in-the-loop
 * 
 * Steps:
 * 1. Scan folder for files matching criteria
 * 2. SUSPEND: Show files to user, wait for approval
 * 3. If approved: Delete files
 * 4. Generate report
 * 
 * Use case: Safe deletion requiring human confirmation
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// File info schema
const fileInfoSchema = z.object({
  name: z.string(),
  path: z.string(),
  size: z.number(),
  sizeFormatted: z.string(),
  modified: z.number(),
  modifiedDate: z.string(),
  extension: z.string(),
});

// Helper: format bytes
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Step 1: Scan for files to delete
const scanFilesStep = createStep({
  id: "scan-files",
  inputSchema: z.object({
    folderPath: z.string(),
    criteria: z.object({
      // Match files older than N days
      olderThanDays: z.number().optional(),
      // Match files larger than N MB
      largerThanMB: z.number().optional(),
      // Match specific extensions
      extensions: z.array(z.string()).optional(),
      // Match filename pattern (regex)
      namePattern: z.string().optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    folderPath: z.string(),
    filesToDelete: z.array(fileInfoSchema),
    totalSize: z.number(),
    totalSizeFormatted: z.string(),
    fileCount: z.number(),
    criteria: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { folderPath, criteria = {} } = inputData;
    
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Folder not found: ${folderPath}`);
    }
    
    const now = Date.now();
    const files: z.infer<typeof fileInfoSchema>[] = [];
    let totalSize = 0;
    
    // Build criteria description
    const criteriaDesc: string[] = [];
    if (criteria.olderThanDays) criteriaDesc.push(`older than ${criteria.olderThanDays} days`);
    if (criteria.largerThanMB) criteriaDesc.push(`larger than ${criteria.largerThanMB} MB`);
    if (criteria.extensions?.length) criteriaDesc.push(`extensions: ${criteria.extensions.join(", ")}`);
    if (criteria.namePattern) criteriaDesc.push(`pattern: ${criteria.namePattern}`);
    if (criteriaDesc.length === 0) criteriaDesc.push("all files");
    
    // Scan directory
    const items = fs.readdirSync(folderPath, { withFileTypes: true });
    
    for (const item of items) {
      if (!item.isFile()) continue;
      
      const filePath = path.join(folderPath, item.name);
      const stats = fs.statSync(filePath);
      const ext = path.extname(item.name).toLowerCase();
      const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      const sizeMB = stats.size / (1024 * 1024);
      
      // Apply criteria filters
      let matches = true;
      
      if (criteria.olderThanDays && ageDays < criteria.olderThanDays) {
        matches = false;
      }
      if (criteria.largerThanMB && sizeMB < criteria.largerThanMB) {
        matches = false;
      }
      if (criteria.extensions?.length && !criteria.extensions.includes(ext)) {
        matches = false;
      }
      if (criteria.namePattern) {
        try {
          const regex = new RegExp(criteria.namePattern, "i");
          if (!regex.test(item.name)) matches = false;
        } catch {
          // Invalid regex, skip this filter
        }
      }
      
      if (matches) {
        files.push({
          name: item.name,
          path: filePath,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          modified: stats.mtimeMs,
          modifiedDate: new Date(stats.mtimeMs).toLocaleDateString(),
          extension: ext,
        });
        totalSize += stats.size;
      }
    }
    
    // Sort by size descending
    files.sort((a, b) => b.size - a.size);
    
    return {
      folderPath,
      filesToDelete: files,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      fileCount: files.length,
      criteria: criteriaDesc.join(", "),
    };
  },
});

// Step 2: Wait for human approval (SUSPEND)
const awaitApprovalStep = createStep({
  id: "await-approval",
  inputSchema: z.object({
    folderPath: z.string(),
    filesToDelete: z.array(fileInfoSchema),
    totalSize: z.number(),
    totalSizeFormatted: z.string(),
    fileCount: z.number(),
    criteria: z.string(),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    filesToDelete: z.array(fileInfoSchema),
    folderPath: z.string(),
    approvedAt: z.number().optional(),
    rejectionReason: z.string().optional(),
  }),
  // Resume schema — what data is needed to continue
  resumeSchema: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
  // Suspend schema — what data to show while suspended
  suspendSchema: z.object({
    message: z.string(),
    fileCount: z.number(),
    totalSize: z.string(),
    fileList: z.array(z.string()),
  }),
  execute: async ({ inputData, resumeData, suspend, suspendData }) => {
    const { filesToDelete, folderPath, fileCount, totalSizeFormatted } = inputData;
    
    // If no files to delete, skip approval
    if (fileCount === 0) {
      return {
        approved: false,
        filesToDelete: [],
        folderPath,
        rejectionReason: "No files match the criteria",
      };
    }
    
    // Check if we have resume data (user responded)
    if (resumeData) {
      if (resumeData.approved) {
        return {
          approved: true,
          filesToDelete,
          folderPath,
          approvedAt: Date.now(),
        };
      } else {
        return {
          approved: false,
          filesToDelete: [],
          folderPath,
          rejectionReason: resumeData.reason || "User rejected deletion",
        };
      }
    }
    
    // No resume data — SUSPEND and wait for human
    const fileList = filesToDelete.slice(0, 10).map(
      (f) => `${f.name} (${f.sizeFormatted}, ${f.modifiedDate})`
    );
    if (filesToDelete.length > 10) {
      fileList.push(`... and ${filesToDelete.length - 10} more files`);
    }
    
    return suspend({
      message: `⚠️ DELETE CONFIRMATION REQUIRED\n\nFolder: ${folderPath}\nFiles: ${fileCount}\nTotal size: ${totalSizeFormatted}\n\nResume with { approved: true } to proceed or { approved: false, reason: "..." } to cancel.`,
      fileCount,
      totalSize: totalSizeFormatted,
      fileList,
    });
  },
});

// Step 3: Delete files (only if approved)
const deleteFilesStep = createStep({
  id: "delete-files",
  inputSchema: z.object({
    approved: z.boolean(),
    filesToDelete: z.array(fileInfoSchema),
    folderPath: z.string(),
    approvedAt: z.number().optional(),
    rejectionReason: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    deleted: z.array(z.string()),
    failed: z.array(z.object({
      file: z.string(),
      error: z.string(),
    })),
    freedSpace: z.string(),
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { approved, filesToDelete, folderPath, rejectionReason } = inputData;
    
    // If not approved, return early
    if (!approved) {
      return {
        success: false,
        deleted: [],
        failed: [],
        freedSpace: "0 B",
        summary: `❌ Cleanup cancelled: ${rejectionReason || "Not approved"}`,
      };
    }
    
    const deleted: string[] = [];
    const failed: { file: string; error: string }[] = [];
    let freedBytes = 0;
    
    for (const file of filesToDelete) {
      try {
        fs.unlinkSync(file.path);
        deleted.push(file.name);
        freedBytes += file.size;
      } catch (err: any) {
        failed.push({ file: file.name, error: err.message });
      }
    }
    
    const freedSpace = formatBytes(freedBytes);
    
    let summary = `✅ Cleanup completed!\n\n`;
    summary += `**Folder:** ${folderPath}\n`;
    summary += `**Deleted:** ${deleted.length} files\n`;
    summary += `**Freed space:** ${freedSpace}\n`;
    
    if (failed.length > 0) {
      summary += `\n⚠️ Failed to delete ${failed.length} files:\n`;
      summary += failed.map((f) => `- ${f.file}: ${f.error}`).join("\n");
    }
    
    return {
      success: failed.length === 0,
      deleted,
      failed,
      freedSpace,
      summary,
    };
  },
});

// Create the workflow with SUSPEND/RESUME
export const fileCleanupWorkflow = createWorkflow({
  id: "file-cleanup",
  inputSchema: z.object({
    folderPath: z.string(),
    criteria: z.object({
      olderThanDays: z.number().optional(),
      largerThanMB: z.number().optional(),
      extensions: z.array(z.string()).optional(),
      namePattern: z.string().optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    deleted: z.array(z.string()),
    failed: z.array(z.object({
      file: z.string(),
      error: z.string(),
    })),
    freedSpace: z.string(),
    summary: z.string(),
  }),
})
  .then(scanFilesStep)
  .then(awaitApprovalStep)  // <-- SUSPENDS HERE waiting for human
  .then(deleteFilesStep)
  .commit();
