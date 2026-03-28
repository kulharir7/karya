/**
 * Document Tools — CSV export, markdown convert, text processing
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const WORKSPACE = path.join(process.cwd(), "workspace");

// ---- csv-export ----
export const csvExportTool = createTool({
  id: "csv-export",
  description: "Export data to a CSV file. Pass headers + rows or JSON array.",
  inputSchema: z.object({
    filename: z.string().describe("Output filename (e.g., data.csv)"),
    headers: z.array(z.string()).optional().describe("Column headers"),
    rows: z.array(z.array(z.string())).optional().describe("Data rows"),
    jsonData: z.string().optional().describe("JSON array string to convert to CSV"),
  }),
  execute: async ({ filename, headers, rows, jsonData }) => {
    try {
      let csvContent = "";
      if (jsonData) {
        const data = JSON.parse(jsonData);
        if (Array.isArray(data) && data.length > 0) {
          const keys = Object.keys(data[0]);
          csvContent = keys.join(",") + "\n";
          csvContent += data.map((row: any) => keys.map((k) => `"${String(row[k] || "").replace(/"/g, '""')}"`).join(",")).join("\n");
        }
      } else if (headers && rows) {
        csvContent = headers.join(",") + "\n";
        csvContent += rows.map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
      }
      const filePath = path.isAbsolute(filename) ? filename : path.join(WORKSPACE, filename);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, csvContent, "utf-8");
      return { success: true, path: filePath, rows: csvContent.split("\n").length - 1 };
    } catch (err: any) {
      return { success: false, path: "", rows: 0, error: err.message };
    }
  },
});

// ---- markdown-to-html ----
export const markdownToHtmlTool = createTool({
  id: "markdown-to-html",
  description: "Convert markdown text to HTML. Useful for generating web content.",
  inputSchema: z.object({
    markdown: z.string().describe("Markdown text to convert"),
    outputFile: z.string().optional().describe("Optional: save HTML to file"),
  }),
  execute: async ({ markdown, outputFile }) => {
    // Simple markdown to HTML conversion
    let html = markdown
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/^\- (.+)$/gm, "<li>$1</li>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");
    html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6}code{background:#f4f4f4;padding:2px 6px;border-radius:3px}h1,h2,h3{color:#333}</style></head><body><p>${html}</p></body></html>`;
    
    if (outputFile) {
      const filePath = path.isAbsolute(outputFile) ? outputFile : path.join(WORKSPACE, outputFile);
      fs.writeFileSync(filePath, html, "utf-8");
      return { success: true, path: filePath, length: html.length };
    }
    return { success: true, html: html.slice(0, 5000), length: html.length };
  },
});

// ---- json-to-table ----
export const jsonToTableTool = createTool({
  id: "json-to-table",
  description: "Convert JSON data to a formatted table string. Useful for displaying structured data.",
  inputSchema: z.object({
    jsonData: z.string().describe("JSON array string"),
  }),
  execute: async ({ jsonData }) => {
    try {
      const data = JSON.parse(jsonData);
      if (!Array.isArray(data) || data.length === 0) return { success: false, table: "Empty array" };
      const keys = Object.keys(data[0]);
      const header = "| " + keys.join(" | ") + " |";
      const separator = "| " + keys.map(() => "---").join(" | ") + " |";
      const rows = data.map((row: any) => "| " + keys.map((k) => String(row[k] || "")).join(" | ") + " |");
      const table = [header, separator, ...rows].join("\n");
      return { success: true, table, rows: data.length, columns: keys.length };
    } catch (err: any) {
      return { success: false, table: "", rows: 0, columns: 0, error: err.message };
    }
  },
});
