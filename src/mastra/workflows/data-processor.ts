/**
 * Data Processor Workflow
 * 
 * Demonstrates: .branch() conditional routing
 * 
 * Steps:
 * 1. Detect file type (CSV, JSON, TXT)
 * 2. Branch to appropriate parser
 * 3. Transform/analyze data
 * 4. Generate report
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// File types
type FileType = "csv" | "json" | "txt" | "unknown";

// Step 1: Detect file type
const detectTypeStep = createStep({
  id: "detect-type",
  inputSchema: z.object({
    filePath: z.string(),
    outputFormat: z.enum(["summary", "detailed", "json"]).optional().default("summary"),
  }),
  outputSchema: z.object({
    filePath: z.string(),
    outputFormat: z.string(),
    fileType: z.enum(["csv", "json", "txt", "unknown"]),
    fileSize: z.number(),
    fileName: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { filePath, outputFormat } = inputData;
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    
    let fileType: FileType = "unknown";
    if (ext === ".csv") fileType = "csv";
    else if (ext === ".json") fileType = "json";
    else if (ext === ".txt" || ext === ".md") fileType = "txt";
    
    return {
      filePath,
      outputFormat: outputFormat || "summary",
      fileType,
      fileSize: stats.size,
      fileName,
    };
  },
});

// Step 2a: Parse CSV
const parseCsvStep = createStep({
  id: "parse-csv",
  inputSchema: z.object({
    filePath: z.string(),
    outputFormat: z.string(),
    fileType: z.enum(["csv", "json", "txt", "unknown"]),
    fileSize: z.number(),
    fileName: z.string(),
  }),
  outputSchema: z.object({
    fileName: z.string(),
    outputFormat: z.string(),
    dataType: z.literal("csv"),
    rowCount: z.number(),
    columns: z.array(z.string()),
    data: z.array(z.record(z.string(), z.string())),
    preview: z.array(z.record(z.string(), z.string())),
  }),
  execute: async ({ inputData }) => {
    const { filePath, fileName, outputFormat } = inputData;
    
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    
    if (lines.length === 0) {
      return {
        fileName,
        outputFormat,
        dataType: "csv" as const,
        rowCount: 0,
        columns: [],
        data: [],
        preview: [],
      };
    }
    
    // Parse header
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    
    // Parse rows
    const data = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });
      return row;
    });
    
    return {
      fileName,
      outputFormat,
      dataType: "csv" as const,
      rowCount: data.length,
      columns: headers,
      data,
      preview: data.slice(0, 5),
    };
  },
});

// Step 2b: Parse JSON
const parseJsonStep = createStep({
  id: "parse-json",
  inputSchema: z.object({
    filePath: z.string(),
    outputFormat: z.string(),
    fileType: z.enum(["csv", "json", "txt", "unknown"]),
    fileSize: z.number(),
    fileName: z.string(),
  }),
  outputSchema: z.object({
    fileName: z.string(),
    outputFormat: z.string(),
    dataType: z.literal("json"),
    rowCount: z.number(),
    columns: z.array(z.string()),
    data: z.array(z.record(z.string(), z.any())),
    preview: z.array(z.record(z.string(), z.any())),
  }),
  execute: async ({ inputData }) => {
    const { filePath, fileName, outputFormat } = inputData;
    
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);
    
    // Handle array or single object
    const data = Array.isArray(parsed) ? parsed : [parsed];
    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    
    return {
      fileName,
      outputFormat,
      dataType: "json" as const,
      rowCount: data.length,
      columns,
      data,
      preview: data.slice(0, 5),
    };
  },
});

// Step 2c: Parse TXT
const parseTxtStep = createStep({
  id: "parse-txt",
  inputSchema: z.object({
    filePath: z.string(),
    outputFormat: z.string(),
    fileType: z.enum(["csv", "json", "txt", "unknown"]),
    fileSize: z.number(),
    fileName: z.string(),
  }),
  outputSchema: z.object({
    fileName: z.string(),
    outputFormat: z.string(),
    dataType: z.literal("txt"),
    rowCount: z.number(),
    columns: z.array(z.string()),
    data: z.array(z.record(z.string(), z.any())),
    preview: z.array(z.record(z.string(), z.any())),
  }),
  execute: async ({ inputData }) => {
    const { filePath, fileName, outputFormat } = inputData;
    
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    
    const data = lines.map((line, i) => ({
      lineNumber: i + 1,
      content: line,
      wordCount: line.split(/\s+/).length,
    }));
    
    return {
      fileName,
      outputFormat,
      dataType: "txt" as const,
      rowCount: lines.length,
      columns: ["lineNumber", "content", "wordCount"],
      data,
      preview: data.slice(0, 5),
    };
  },
});

// Step 3: Generate report (handles all data types)
const generateReportStep = createStep({
  id: "generate-report",
  inputSchema: z.object({
    "parse-csv": z.object({
      fileName: z.string(),
      outputFormat: z.string(),
      dataType: z.literal("csv"),
      rowCount: z.number(),
      columns: z.array(z.string()),
      data: z.array(z.record(z.string(), z.string())),
      preview: z.array(z.record(z.string(), z.string())),
    }).optional(),
    "parse-json": z.object({
      fileName: z.string(),
      outputFormat: z.string(),
      dataType: z.literal("json"),
      rowCount: z.number(),
      columns: z.array(z.string()),
      data: z.array(z.record(z.string(), z.any())),
      preview: z.array(z.record(z.string(), z.any())),
    }).optional(),
    "parse-txt": z.object({
      fileName: z.string(),
      outputFormat: z.string(),
      dataType: z.literal("txt"),
      rowCount: z.number(),
      columns: z.array(z.string()),
      data: z.array(z.record(z.string(), z.any())),
      preview: z.array(z.record(z.string(), z.any())),
    }).optional(),
  }),
  outputSchema: z.object({
    fileName: z.string(),
    dataType: z.string(),
    summary: z.string(),
    rowCount: z.number(),
    columnCount: z.number(),
    columns: z.array(z.string()),
    statistics: z.record(z.string(), z.any()),
  }),
  execute: async ({ inputData }) => {
    // Get whichever branch executed
    const parsedData = inputData["parse-csv"] || inputData["parse-json"] || inputData["parse-txt"];
    
    if (!parsedData) {
      throw new Error("No parsed data available");
    }
    
    const { fileName, dataType, rowCount, columns, data, outputFormat } = parsedData;
    
    // Calculate statistics based on data type
    const statistics: Record<string, any> = {
      totalRows: rowCount,
      totalColumns: columns.length,
    };
    
    if (dataType === "csv" || dataType === "json") {
      // Try to calculate numeric stats
      for (const col of columns) {
        const values = data.map((row) => row[col]).filter((v) => v !== undefined && v !== null);
        const numericValues = values.map(Number).filter((n) => !isNaN(n));
        
        if (numericValues.length > 0 && numericValues.length === values.length) {
          statistics[col] = {
            min: Math.min(...numericValues),
            max: Math.max(...numericValues),
            avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
          };
        } else {
          // String column - count unique values
          statistics[col] = {
            uniqueValues: new Set(values.map(String)).size,
            sampleValues: values.slice(0, 3),
          };
        }
      }
    } else if (dataType === "txt") {
      const wordCounts = data.map((row) => (row as any).wordCount as number);
      statistics.totalWords = wordCounts.reduce((a, b) => a + b, 0);
      statistics.avgWordsPerLine = statistics.totalWords / rowCount;
    }
    
    // Generate summary
    let summary = `## Data Analysis Report: ${fileName}\n\n`;
    summary += `**File Type:** ${dataType.toUpperCase()}\n`;
    summary += `**Total Rows:** ${rowCount}\n`;
    summary += `**Columns:** ${columns.join(", ")}\n\n`;
    
    if (outputFormat === "detailed") {
      summary += "### Statistics\n\n";
      for (const [key, value] of Object.entries(statistics)) {
        if (key !== "totalRows" && key !== "totalColumns") {
          summary += `**${key}:** ${JSON.stringify(value)}\n`;
        }
      }
    }
    
    return {
      fileName,
      dataType,
      summary,
      rowCount,
      columnCount: columns.length,
      columns,
      statistics,
    };
  },
});

// Create the workflow with branching
export const dataProcessorWorkflow = createWorkflow({
  id: "data-processor",
  inputSchema: z.object({
    filePath: z.string(),
    outputFormat: z.enum(["summary", "detailed", "json"]).optional(),
  }),
  outputSchema: z.object({
    fileName: z.string(),
    dataType: z.string(),
    summary: z.string(),
    rowCount: z.number(),
    columnCount: z.number(),
    columns: z.array(z.string()),
    statistics: z.record(z.string(), z.any()),
  }),
})
  .then(detectTypeStep)
  .branch([
    [async ({ inputData }) => inputData.fileType === "csv", parseCsvStep],
    [async ({ inputData }) => inputData.fileType === "json", parseJsonStep],
    [async ({ inputData }) => inputData.fileType === "txt", parseTxtStep],
  ])
  .then(generateReportStep)
  .commit();
