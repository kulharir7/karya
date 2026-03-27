/**
 * Karya Memory System — Conversation Memory with Mastra
 * 
 * Uses Mastra's official Memory class with LibSQLStore.
 * Note: Mastra Memory is designed for agent-level use, not direct queries.
 * For direct message access, use storage APIs directly.
 */

import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

// Storage for messages
const storage = new LibSQLStore({
  id: "karya-storage",
  url: "file:karya-memory.db",
});

// Create memory WITHOUT semantic recall (for now)
// TODO: Enable semantic recall once embedding model is configured
export const memory = new Memory({
  storage,
  options: {
    // Recent message history
    lastMessages: 20,
    // Semantic recall disabled (needs embedder)
    semanticRecall: false,
  },
});

/**
 * Get recent messages from a thread
 * Note: Mastra Memory doesn't expose direct query API anymore
 * This is a stub that returns empty array - actual memory is handled by agent
 */
export async function getThreadMessages(
  threadId: string,
  limit: number = 20
): Promise<any[]> {
  // Mastra Memory v2+ doesn't have direct query() method
  // Memory is accessed through agent.generate() with memory option
  // For direct access, use storage APIs
  console.log(`[memory] getThreadMessages called for thread: ${threadId}, limit: ${limit}`);
  console.log("[memory] Note: Use agent.generate() with memory option for proper memory access");
  return [];
}

/**
 * Semantic search placeholder
 * For now, falls back to workspace memory search
 */
export async function semanticSearch(
  threadId: string,
  query: string,
  topK: number = 5
): Promise<any[]> {
  // Semantic search requires agent-level memory with embedder
  console.log(`[memory] Semantic search fallback for: "${query}"`);
  return [];
}

/**
 * Get memory instance for agent use
 */
export function getMemory() {
  return memory;
}

/**
 * Get storage instance for direct access if needed
 */
export function getStorage() {
  return storage;
}
