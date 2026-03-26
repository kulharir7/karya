import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export const apiCallTool = createTool({
  id: "api-call",
  description:
    "Make an HTTP request to any API endpoint. Supports GET, POST, PUT, DELETE. " +
    "Use for: fetching data from APIs, webhooks, testing endpoints, downloading JSON data.",
  inputSchema: z.object({
    url: z.string().describe("The API URL to call"),
    method: z.string().optional().describe("HTTP method: GET, POST, PUT, DELETE (default: GET)"),
    headers: z.record(z.string(), z.string()).optional().describe("Request headers as key-value pairs"),
    body: z.string().optional().describe("Request body (JSON string for POST/PUT)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    status: z.number(),
    data: z.string(),
    contentType: z.string(),
  }),
  execute: async ({ url, method, headers, body }) => {
    try {
      const res = await fetch(url, {
        method: method || "GET",
        headers: { "Content-Type": "application/json", ...headers },
        body: body || undefined,
      });
      const contentType = res.headers.get("content-type") || "";
      let data: string;
      if (contentType.includes("json")) {
        data = JSON.stringify(await res.json(), null, 2);
      } else {
        data = await res.text();
      }
      return {
        success: res.ok,
        status: res.status,
        data: data.slice(0, 20000),
        contentType,
      };
    } catch (err: any) {
      return { success: false, status: 0, data: err.message, contentType: "" };
    }
  },
});

export const csvParseTool = createTool({
  id: "data-csv-parse",
  description:
    "Parse a CSV file and return structured data. Use for: reading spreadsheets, " +
    "analyzing tabular data, extracting rows/columns from CSV files.",
  inputSchema: z.object({
    filePath: z.string().describe("Path to the CSV file"),
    limit: z.number().optional().describe("Max rows to return (default: 50)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    headers: z.array(z.string()),
    rows: z.array(z.record(z.string(), z.string())),
    totalRows: z.number(),
  }),
  execute: async ({ filePath, limit }) => {
    try {
      const content = fs.readFileSync(path.resolve(filePath), "utf-8");
      const lines = content.trim().split("\n");
      if (lines.length === 0) return { success: false, headers: [], rows: [], totalRows: 0 };

      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1, (limit || 50) + 1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] || ""; });
        return row;
      });

      return { success: true, headers, rows, totalRows: lines.length - 1 };
    } catch (err: any) {
      return { success: false, headers: [], rows: [], totalRows: 0 };
    }
  },
});

export const jsonQueryTool = createTool({
  id: "data-json-query",
  description:
    "Read a JSON file and extract specific data. Use for: parsing config files, " +
    "reading package.json, extracting nested data from JSON.",
  inputSchema: z.object({
    filePath: z.string().describe("Path to the JSON file"),
    query: z.string().optional().describe("Dot-notation path to extract (e.g., 'name', 'dependencies.react'). Leave empty for full file."),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.string(),
    type: z.string(),
  }),
  execute: async ({ filePath, query }) => {
    try {
      const content = fs.readFileSync(path.resolve(filePath), "utf-8");
      let data = JSON.parse(content);

      if (query) {
        const parts = query.split(".");
        for (const part of parts) {
          if (data && typeof data === "object" && part in data) {
            data = data[part];
          } else {
            return { success: false, data: `Path '${query}' not found`, type: "error" };
          }
        }
      }

      return {
        success: true,
        data: typeof data === "string" ? data : JSON.stringify(data, null, 2).slice(0, 20000),
        type: Array.isArray(data) ? "array" : typeof data,
      };
    } catch (err: any) {
      return { success: false, data: err.message, type: "error" };
    }
  },
});

export const dataTransformTool = createTool({
  id: "data-transform",
  description:
    "Transform data between formats. Supports: JSON↔CSV, text processing, " +
    "data filtering, sorting, aggregation. Runs JavaScript transform code.",
  inputSchema: z.object({
    inputPath: z.string().describe("Path to input data file"),
    outputPath: z.string().describe("Path to save transformed output"),
    transform: z.string().describe("JavaScript code that transforms 'data' variable. Example: 'data.filter(r => r.age > 18)'"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    outputPath: z.string(),
    info: z.string(),
  }),
  execute: async ({ inputPath, outputPath, transform }) => {
    try {
      const content = fs.readFileSync(path.resolve(inputPath), "utf-8");
      let data: any;
      try { data = JSON.parse(content); } catch { data = content; }

      // Execute transform
      const fn = new Function("data", `return ${transform}`);
      const result = fn(data);

      const output = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      const outResolved = path.resolve(outputPath);
      const dir = path.dirname(outResolved);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outResolved, output, "utf-8");

      return {
        success: true,
        outputPath: outResolved,
        info: `Transformed ${(content.length / 1024).toFixed(1)} KB → ${(output.length / 1024).toFixed(1)} KB`,
      };
    } catch (err: any) {
      return { success: false, outputPath: "", info: `Error: ${err.message}` };
    }
  },
});
