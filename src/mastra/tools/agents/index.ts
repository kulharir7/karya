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

// Shared context between agents (Point 23: Agent-to-Agent Communication)
const agentContext: Map<string, { from: string; data: string; timestamp: number }[]> = new Map();

async function callSpecialistAgent(agentId: string, task: string, context?: string): Promise<string> {
  try {
    const { mastra } = await import("@/mastra");
    const agent = mastra.getAgent(agentId as any);

    // Build messages with shared context
    const messages: { role: "system" | "user"; content: string }[] = [];

    // Inject shared context from other agents
    const sharedCtx = agentContext.get(agentId);
    if (sharedCtx && sharedCtx.length > 0) {
      const ctxText = sharedCtx.map(c => `[From ${c.from}]: ${c.data}`).join("\n");
      messages.push({ role: "system", content: `## Context from other agents:\n${ctxText}` });
      // Clear after consumption
      agentContext.delete(agentId);
    }

    // Inject caller-provided context
    if (context) {
      messages.push({ role: "system", content: `## Additional context:\n${context}` });
    }

    messages.push({ role: "user", content: task });

    const result = await agent.generate(messages as any);
    return result.text || "Task completed.";
  } catch (err: any) {
    return `Agent error: ${err.message}`;
  }
}

/**
 * Pass context to another agent (Point 23)
 */
export const passContextToAgent = createTool({
  id: "pass-context",
  description: `Pass data/context from the current task to another specialist agent. 
Use this when one agent's output is needed by another agent.
Example: Browser extracts data → pass to Data Analyst for analysis.`,
  inputSchema: z.object({
    targetAgent: z.enum(["karya-browser", "karya-file", "karya-coder", "karya-researcher", "karya-data-analyst"])
      .describe("Which agent should receive this context"),
    data: z.string().describe("The data/context to pass"),
    fromAgent: z.string().optional().describe("Which agent is sending this (defaults to 'supervisor')"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ targetAgent, data, fromAgent }) => {
    const existing = agentContext.get(targetAgent) || [];
    existing.push({ from: fromAgent || "supervisor", data, timestamp: Date.now() });
    agentContext.set(targetAgent, existing);
    return {
      success: true,
      message: `✅ Context passed to ${targetAgent}. It will receive this data in its next call.`,
    };
  },
});

/**
 * Agent Handoff — Chain agents: browser → data-analyst (Point 24)
 */
export const agentHandoffTool = createTool({
  id: "agent-handoff",
  description: `Chain two agents together: first agent runs a task, then its output is passed to the second agent.
Perfect for: browser extracts data → data-analyst analyzes it, or researcher finds info → coder builds it.`,
  inputSchema: z.object({
    firstAgent: z.enum(["karya-browser", "karya-file", "karya-coder", "karya-researcher", "karya-data-analyst"])
      .describe("First agent to run"),
    firstTask: z.string().describe("Task for the first agent"),
    secondAgent: z.enum(["karya-browser", "karya-file", "karya-coder", "karya-researcher", "karya-data-analyst"])
      .describe("Second agent to run with first agent's output"),
    secondTask: z.string().describe("Task for the second agent (will also receive first agent's output as context)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    firstResult: z.string(),
    secondResult: z.string(),
    message: z.string(),
  }),
  execute: async ({ firstAgent, firstTask, secondAgent, secondTask }) => {
    // Run first agent
    const firstResult = await callSpecialistAgent(firstAgent, firstTask);

    // Pass result as context to second agent
    const secondResult = await callSpecialistAgent(
      secondAgent,
      secondTask,
      `Output from ${firstAgent}:\n${firstResult}`
    );

    return {
      success: true,
      firstResult,
      secondResult,
      message: `✅ Handoff complete: ${firstAgent} → ${secondAgent}`,
    };
  },
});

/**
 * Code Review — Feedback Loop (Point 25)
 * Coder writes code, then Reviewer checks it
 */
export const codeReviewTool = createTool({
  id: "code-review",
  description: `Submit code for review by running it through the Coder agent with review instructions.
Use this after code is written to check quality, find bugs, and suggest improvements.
The coder agent will act as a reviewer and provide feedback.`,
  inputSchema: z.object({
    code: z.string().describe("The code to review"),
    language: z.string().optional().describe("Programming language"),
    requirements: z.string().optional().describe("What the code should do"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    review: z.string(),
  }),
  execute: async ({ code, language, requirements }) => {
    const reviewTask = `REVIEW this ${language || ""} code. Be critical and thorough.

${requirements ? `Requirements: ${requirements}\n` : ""}
Code to review:
\`\`\`${language || ""}
${code}
\`\`\`

Check for:
1. Bugs and logic errors
2. Security issues
3. Performance problems
4. Code quality and readability
5. Missing error handling
6. Does it meet the requirements?

Provide specific feedback with line references. Be honest — if it's good, say so. If it's bad, explain why.`;

    const review = await callSpecialistAgent("karya-coder", reviewTask);
    return { success: true, review };
  },
});

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
