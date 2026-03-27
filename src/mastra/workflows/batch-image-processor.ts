/**
 * Batch Image Processor Workflow
 * 
 * Demonstrates: .foreach() loop — process array items
 * 
 * Steps:
 * 1. Collect images from folder
 * 2. FOREACH: Process each image (resize, compress)
 * 3. Aggregate results
 * 
 * Use case: Bulk image processing with concurrency control
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

// Image info schema
const imageInfoSchema = z.object({
  name: z.string(),
  path: z.string(),
  size: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
});

// Processed image result
const processedImageSchema = z.object({
  original: z.string(),
  output: z.string(),
  originalSize: z.number(),
  newSize: z.number(),
  width: z.number(),
  height: z.number(),
  saved: z.number(),
  savedPercent: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});

// Helper: format bytes
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Step 1: Collect images from folder
const collectImagesStep = createStep({
  id: "collect-images",
  inputSchema: z.object({
    folderPath: z.string(),
    outputFolder: z.string().optional(),
    maxWidth: z.number().optional().default(1920),
    maxHeight: z.number().optional().default(1080),
    quality: z.number().optional().default(80),
    format: z.enum(["jpeg", "png", "webp"]).optional().default("jpeg"),
  }),
  outputSchema: z.array(z.object({
    image: imageInfoSchema,
    outputFolder: z.string(),
    maxWidth: z.number(),
    maxHeight: z.number(),
    quality: z.number(),
    format: z.string(),
  })),
  execute: async ({ inputData }) => {
    const { 
      folderPath, 
      outputFolder, 
      maxWidth = 1920, 
      maxHeight = 1080, 
      quality = 80,
      format = "jpeg",
    } = inputData;
    
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Folder not found: ${folderPath}`);
    }
    
    // Create output folder
    const outDir = outputFolder || path.join(folderPath, "processed");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    
    // Find all images
    const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"];
    const items = fs.readdirSync(folderPath, { withFileTypes: true });
    
    const images: Array<{
      image: z.infer<typeof imageInfoSchema>;
      outputFolder: string;
      maxWidth: number;
      maxHeight: number;
      quality: number;
      format: string;
    }> = [];
    
    for (const item of items) {
      if (!item.isFile()) continue;
      
      const ext = path.extname(item.name).toLowerCase();
      if (!imageExtensions.includes(ext)) continue;
      
      const filePath = path.join(folderPath, item.name);
      const stats = fs.statSync(filePath);
      
      images.push({
        image: {
          name: item.name,
          path: filePath,
          size: stats.size,
        },
        outputFolder: outDir,
        maxWidth,
        maxHeight,
        quality,
        format,
      });
    }
    
    if (images.length === 0) {
      throw new Error(`No images found in ${folderPath}`);
    }
    
    return images;
  },
});

// Step 2: Process single image (runs for EACH image)
const processImageStep = createStep({
  id: "process-image",
  inputSchema: z.object({
    image: imageInfoSchema,
    outputFolder: z.string(),
    maxWidth: z.number(),
    maxHeight: z.number(),
    quality: z.number(),
    format: z.string(),
  }),
  outputSchema: processedImageSchema,
  execute: async ({ inputData }) => {
    const { image, outputFolder, maxWidth, maxHeight, quality, format } = inputData;
    
    try {
      // Determine output filename
      const baseName = path.basename(image.name, path.extname(image.name));
      const outputName = `${baseName}.${format}`;
      const outputPath = path.join(outputFolder, outputName);
      
      // Process with sharp
      let sharpInstance = sharp(image.path);
      
      // Get original metadata
      const metadata = await sharpInstance.metadata();
      const origWidth = metadata.width || 0;
      const origHeight = metadata.height || 0;
      
      // Resize if needed (maintain aspect ratio)
      if (origWidth > maxWidth || origHeight > maxHeight) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }
      
      // Convert and compress
      if (format === "jpeg") {
        sharpInstance = sharpInstance.jpeg({ quality });
      } else if (format === "png") {
        sharpInstance = sharpInstance.png({ quality });
      } else if (format === "webp") {
        sharpInstance = sharpInstance.webp({ quality });
      }
      
      // Save
      await sharpInstance.toFile(outputPath);
      
      // Get new file size
      const newStats = fs.statSync(outputPath);
      const saved = image.size - newStats.size;
      const savedPercent = ((saved / image.size) * 100).toFixed(1);
      
      // Get new dimensions
      const newMetadata = await sharp(outputPath).metadata();
      
      return {
        original: image.name,
        output: outputName,
        originalSize: image.size,
        newSize: newStats.size,
        width: newMetadata.width || 0,
        height: newMetadata.height || 0,
        saved,
        savedPercent: `${savedPercent}%`,
        success: true,
      };
    } catch (err: any) {
      return {
        original: image.name,
        output: "",
        originalSize: image.size,
        newSize: 0,
        width: 0,
        height: 0,
        saved: 0,
        savedPercent: "0%",
        success: false,
        error: err.message,
      };
    }
  },
});

// Step 3: Aggregate results
const aggregateResultsStep = createStep({
  id: "aggregate-results",
  inputSchema: z.array(processedImageSchema),
  outputSchema: z.object({
    totalImages: z.number(),
    successful: z.number(),
    failed: z.number(),
    totalOriginalSize: z.string(),
    totalNewSize: z.string(),
    totalSaved: z.string(),
    avgSavedPercent: z.string(),
    results: z.array(z.object({
      file: z.string(),
      status: z.string(),
      saved: z.string(),
    })),
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    const results = inputData;
    
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    
    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalNewSize = successful.reduce((sum, r) => sum + r.newSize, 0);
    const totalSaved = totalOriginalSize - totalNewSize;
    const avgSavedPercent = totalOriginalSize > 0 
      ? ((totalSaved / totalOriginalSize) * 100).toFixed(1)
      : "0";
    
    const resultsList = results.map((r) => ({
      file: r.original,
      status: r.success ? "✅" : `❌ ${r.error}`,
      saved: r.success ? `${formatBytes(r.saved)} (${r.savedPercent})` : "-",
    }));
    
    let summary = `## Batch Image Processing Complete\n\n`;
    summary += `**Total images:** ${results.length}\n`;
    summary += `**Successful:** ${successful.length}\n`;
    summary += `**Failed:** ${failed.length}\n\n`;
    summary += `**Original size:** ${formatBytes(totalOriginalSize)}\n`;
    summary += `**New size:** ${formatBytes(totalNewSize)}\n`;
    summary += `**Space saved:** ${formatBytes(totalSaved)} (${avgSavedPercent}%)\n`;
    
    if (failed.length > 0) {
      summary += `\n### Failures:\n`;
      for (const f of failed) {
        summary += `- ${f.original}: ${f.error}\n`;
      }
    }
    
    return {
      totalImages: results.length,
      successful: successful.length,
      failed: failed.length,
      totalOriginalSize: formatBytes(totalOriginalSize),
      totalNewSize: formatBytes(totalNewSize),
      totalSaved: formatBytes(totalSaved),
      avgSavedPercent: `${avgSavedPercent}%`,
      results: resultsList,
      summary,
    };
  },
});

// Create the workflow with FOREACH
export const batchImageProcessorWorkflow = createWorkflow({
  id: "batch-image-processor",
  inputSchema: z.object({
    folderPath: z.string(),
    outputFolder: z.string().optional(),
    maxWidth: z.number().optional(),
    maxHeight: z.number().optional(),
    quality: z.number().optional(),
    format: z.enum(["jpeg", "png", "webp"]).optional(),
  }),
  outputSchema: z.object({
    totalImages: z.number(),
    successful: z.number(),
    failed: z.number(),
    totalOriginalSize: z.string(),
    totalNewSize: z.string(),
    totalSaved: z.string(),
    avgSavedPercent: z.string(),
    results: z.array(z.object({
      file: z.string(),
      status: z.string(),
      saved: z.string(),
    })),
    summary: z.string(),
  }),
})
  .then(collectImagesStep)
  // FOREACH: Process each image in parallel (concurrency: 4)
  .foreach(processImageStep, { concurrency: 4 })
  .then(aggregateResultsStep)
  .commit();
