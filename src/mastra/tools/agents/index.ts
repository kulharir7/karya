import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Agent-as-Tool Pattern (from "Principles of Building AI Agents" book)
 * 
 * Instead of routing to separate agents via keyword/LLM classification,
 * the supervisor agent can CALL other specialist agents as tools.
 * 
 * This way the supervisor:
 * 1. Decides which specialist to call based on the task
 * 2. Passes relevant context to the specialist
 * 3. Gets results back and can combine outputs from multiple specialists
 * 4. Maintains control over the entire workflow
 */

async function callSpecialistAgent(agentId: string, task: string): Promise<string> {
  try {
    const { mastra } = await import("@/mastra");
    const agent = mastra.getAgent(agentId as any);
    const result = await agent.generate([
      { role: "user" as const, content: task },
    ] as any);
    return result.text || "Task completed.";
  } catch (err: any) {
    return `Agent error: ${err.message}`;
  }
}

/**
 * Delegate to Browser Agent — for web browsing, scraping, site interaction
 */
export const delegateToBrowserAgent = createTool({
  id: "delegate-browser-agent",
  description:
    "Delegate a web browsing task to the Browser specialist agent. " +
    "Use when the task involves: opening websites, clicking buttons, filling forms, " +
    "extracting data from web pages, searching online, booking flights/hotels, " +
    "checking prices on shopping sites. " +
    "Provide a clear, detailed task description.",
  inputSchema: z.object({
    task: z.string().describe("Detailed description of the web browsing task to perform"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    result: z.string(),
  }),
  execute: async ({ task }) => {
    const result = await callSpecialistAgent("karya-browser", task);
    return { success: true, result };
  },
});

/**
 * Delegate to File Agent — for file/folder operations
 */
export const delegateToFileAgent = createTool({
  id: "delegate-file-agent",
  description:
    "Delegate a file management task to the File specialist agent. " +
    "Use when the task involves: reading files, writing files, listing directories, " +
    "moving/renaming files, searching for files, handling PDFs, resizing images, " +
    "creating ZIP archives. " +
    "Provide a clear, detailed task description.",
  inputSchema: z.object({
    task: z.string().describe("Detailed description of the file management task"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    result: z.string(),
  }),
  execute: async ({ task }) => {
    const result = await callSpecialistAgent("karya-file", task);
    return { success: true, result };
  },
});

/**
 * Delegate to Coder Agent — for programming tasks
 */
export const delegateToCoderAgent = createTool({
  id: "delegate-coder-agent",
  description:
    "Delegate a programming task to the Coder specialist agent. " +
    "Use when the task involves: writing code, creating apps/projects/scripts, " +
    "debugging errors, git operations, running shell commands, npm/pip installs, " +
    "code analysis, building software. " +
    "Provide a clear, detailed task description including requirements and file paths.",
  inputSchema: z.object({
    task: z.string().describe("Detailed description of the programming task with requirements"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    result: z.string(),
  }),
  execute: async ({ task }) => {
    const result = await callSpecialistAgent("karya-coder", task);
    return { success: true, result };
  },
});

/**
 * Delegate to Researcher Agent — for information lookup
 */
export const delegateToResearcherAgent = createTool({
  id: "delegate-researcher-agent",
  description:
    "Delegate a research task to the Researcher specialist agent. " +
    "Use when the task involves: searching for information, explaining concepts, " +
    "comparing things, finding facts, looking up news, reading articles, " +
    "deep research on any topic. " +
    "Provide a clear research question or topic.",
  inputSchema: z.object({
    task: z.string().describe("Research question or topic to investigate"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    result: z.string(),
  }),
  execute: async ({ task }) => {
    const result = await callSpecialistAgent("karya-researcher", task);
    return { success: true, result };
  },
});

/**
 * Delegate to Data Analyst Agent — for data processing
 */
export const delegateToDataAnalystAgent = createTool({
  id: "delegate-data-analyst-agent",
  description:
    "Delegate a data analysis task to the Data Analyst specialist agent. " +
    "Use when the task involves: analyzing CSV/JSON files, calculating statistics, " +
    "transforming data, parsing spreadsheets, making API calls for data. " +
    "Provide the file path and analysis requirements.",
  inputSchema: z.object({
    task: z.string().describe("Data analysis task with file paths and requirements"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    result: z.string(),
  }),
  execute: async ({ task }) => {
    const result = await callSpecialistAgent("karya-data-analyst", task);
    return { success: true, result };
  },
});
