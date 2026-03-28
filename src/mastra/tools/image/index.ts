/**
 * Image Tools — describe, OCR, download
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const WORKSPACE = path.join(process.cwd(), "workspace");

// ---- image-download ----
export const imageDownloadTool = createTool({
  id: "image-download",
  description: "Download an image from URL and save to workspace.",
  inputSchema: z.object({
    url: z.string().describe("Image URL"),
    filename: z.string().optional().describe("Save as (default: auto from URL)"),
  }),
  execute: async ({ url, filename }) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return { success: false, path: "", error: `HTTP ${res.status}` };
      const buffer = Buffer.from(await res.arrayBuffer());
      const fname = filename || `image-${Date.now()}.${url.split(".").pop()?.split("?")[0] || "png"}`;
      const filePath = path.join(WORKSPACE, fname);
      fs.writeFileSync(filePath, buffer);
      return { success: true, path: filePath, size: `${(buffer.length / 1024).toFixed(1)} KB` };
    } catch (err: any) {
      return { success: false, path: "", error: err.message };
    }
  },
});

// ---- image-info ----
export const imageInfoTool = createTool({
  id: "image-info",
  description: "Get image file information (dimensions, size, format).",
  inputSchema: z.object({
    filePath: z.string().describe("Path to image file"),
  }),
  execute: async ({ filePath }) => {
    try {
      const resolved = path.isAbsolute(filePath) ? filePath : path.join(WORKSPACE, filePath);
      const stats = fs.statSync(resolved);
      const ext = path.extname(resolved).toLowerCase();
      // Read first bytes for dimensions (PNG/JPEG)
      const buf = fs.readFileSync(resolved);
      let width = 0, height = 0;
      if (ext === ".png" && buf.length > 24) {
        width = buf.readUInt32BE(16);
        height = buf.readUInt32BE(20);
      } else if ((ext === ".jpg" || ext === ".jpeg") && buf.length > 2) {
        // Simple JPEG dimension parsing
        let i = 2;
        while (i < buf.length - 8) {
          if (buf[i] === 0xFF && (buf[i + 1] === 0xC0 || buf[i + 1] === 0xC2)) {
            height = buf.readUInt16BE(i + 5);
            width = buf.readUInt16BE(i + 7);
            break;
          }
          i++;
        }
      }
      return {
        success: true, path: resolved, format: ext.replace(".", ""),
        size: `${(stats.size / 1024).toFixed(1)} KB`,
        width, height,
        modified: stats.mtime.toISOString(),
      };
    } catch (err: any) {
      return { success: false, path: filePath, format: "", size: "", width: 0, height: 0, modified: "", error: err.message };
    }
  },
});

// ---- base64-encode ----
export const base64EncodeTool = createTool({
  id: "base64-encode",
  description: "Encode a file to base64 string. Useful for embedding images or sending binary data.",
  inputSchema: z.object({
    filePath: z.string().describe("Path to file"),
  }),
  execute: async ({ filePath }) => {
    try {
      const resolved = path.isAbsolute(filePath) ? filePath : path.join(WORKSPACE, filePath);
      const buf = fs.readFileSync(resolved);
      const base64 = buf.toString("base64");
      const ext = path.extname(resolved).toLowerCase().replace(".", "");
      const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf" };
      return { success: true, base64: base64.slice(0, 1000) + (base64.length > 1000 ? "..." : ""), mimeType: mimeMap[ext] || "application/octet-stream", length: base64.length };
    } catch (err: any) {
      return { success: false, base64: "", mimeType: "", length: 0, error: err.message };
    }
  },
});
