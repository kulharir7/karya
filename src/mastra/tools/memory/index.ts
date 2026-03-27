import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  searchMemory,
  readWorkspaceFile,
  writeWorkspaceFile,
  appendWorkspaceFile,
  logToDaily,
  listMemoryFiles,
  readLongTermMemory,
} from "@/lib/memory-engine";
import { semanticSearch } from "@/lib/memory";

/**
 * Memory Search — semantic search across workspace memory files.
 */
export const memorySearchTool = createTool({
  id: "memory-search",
  description:
    "Search through Karya's memory files (MEMORY.md, daily logs, TOOLS.md, RULES.md). " +
    "Use when the user asks about something from a previous session, or when you need " +
    "to recall past decisions, preferences, or facts.",
  inputSchema: z.object({
    query: z.string().describe("Search query — what to look for in memory"),
    maxResults: z.number().optional().describe("Max results to return (default 10)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(z.object({
      file: z.string(),
      line: z.number(),
      content: z.string(),
      score: z.number(),
    })),
    count: z.number(),
  }),
  execute: async ({ query, maxResults }) => {
    const results = searchMemory(query, maxResults || 10);
    return { success: true, results, count: results.length };
  },
});

/**
 * Memory Read — read a specific workspace file.
 */
export const memoryReadTool = createTool({
  id: "memory-read",
  description:
    "Read a workspace memory file. Available files: MEMORY.md (long-term), TOOLS.md, RULES.md, " +
    "memory/YYYY-MM-DD.md (daily logs). Use to check what's been recorded.",
  inputSchema: z.object({
    file: z.string().describe("File path relative to workspace (e.g., 'MEMORY.md', 'memory/2026-03-27.md')"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string(),
    file: z.string(),
  }),
  execute: async ({ file }) => {
    const content = readWorkspaceFile(file);
    return {
      success: content.length > 0,
      content: content || "(file not found or empty)",
      file,
    };
  },
});

/**
 * Memory Write — write/update a workspace file.
 */
export const memoryWriteTool = createTool({
  id: "memory-write",
  description:
    "Write to a workspace memory file. Use to save important information, update MEMORY.md " +
    "with new facts, or update RULES.md with new behavior rules. " +
    "For daily notes, prefer memory-log (appends automatically).",
  inputSchema: z.object({
    file: z.string().describe("File path relative to workspace (e.g., 'MEMORY.md', 'RULES.md')"),
    content: z.string().describe("Full content to write to the file"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    file: z.string(),
    size: z.number(),
  }),
  execute: async ({ file, content }) => {
    writeWorkspaceFile(file, content);
    return {
      success: true,
      file,
      size: content.length,
    };
  },
});

/**
 * Memory Log — append an entry to today's daily log.
 */
export const memoryLogTool = createTool({
  id: "memory-log",
  description:
    "Append a note to today's daily log (memory/YYYY-MM-DD.md). " +
    "Use to record what happened: tasks completed, decisions made, things learned. " +
    "Automatically adds timestamp.",
  inputSchema: z.object({
    entry: z.string().describe("The note to log (e.g., 'User asked about weather in Delhi')"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ entry }) => {
    logToDaily(entry);
    return {
      success: true,
      message: `Logged to today's daily file`,
    };
  },
});

/**
 * Memory List — list all memory files.
 */
export const memoryListTool = createTool({
  id: "memory-list",
  description:
    "List all workspace memory files with their sizes and last modified dates. " +
    "Use to see what memory files exist.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    files: z.array(z.object({
      file: z.string(),
      size: z.number(),
      modified: z.number(),
    })),
    count: z.number(),
  }),
  execute: async () => {
    const files = listMemoryFiles();
    return { success: true, files, count: files.length };
  },
});

/**
 * Semantic Memory Recall — RAG-based search across conversation history.
 * Uses vector embeddings for similarity search (requires embedder).
 */
export const memoryRecallTool = createTool({
  id: "memory-recall",
  description:
    "Semantic search through past conversations using AI embeddings. " +
    "Finds messages by MEANING, not just keywords. Use when you need to recall what " +
    "the user said about a topic, or find related discussions across sessions. " +
    "Requires embeddings to be configured (OpenAI or FastEmbed).",
  inputSchema: z.object({
    query: z.string().describe("What to search for — natural language question or topic"),
    threadId: z.string().optional().describe("Session/thread ID to search in. Leave empty for current session."),
    topK: z.number().optional().describe("Number of similar messages to return (default 5)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messages: z.array(z.object({
      role: z.string(),
      content: z.string(),
      createdAt: z.string().optional(),
    })),
    count: z.number(),
    query: z.string(),
    embeddingsEnabled: z.boolean(),
  }),
  execute: async ({ query, threadId, topK }) => {
    try {
      // Dynamic import to avoid circular dependencies
      const { getMemoryInstance, semanticRecall } = await import("@/lib/semantic-memory");
      
      const memory = await getMemoryInstance();
      const thread = threadId || "default";
      const messages = await semanticRecall(memory, thread, query, { topK: topK || 5 });
      
      const hasResults = messages.length > 0;
      
      return {
        success: hasResults,
        messages: messages.map((m: any) => ({
          role: m.role || "unknown",
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          createdAt: m.createdAt?.toISOString?.() || undefined,
        })),
        count: messages.length,
        query,
        embeddingsEnabled: true,
      };
    } catch (error: any) {
      return {
        success: false,
        messages: [],
        count: 0,
        query,
        embeddingsEnabled: false,
      };
    }
  },
});
