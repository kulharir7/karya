/**
 * Karya Memory System — Conversation Memory with Mastra
 * 
 * Uses Mastra's official Memory class with LibSQLStore.
 * Semantic recall disabled for now (requires embedding model setup).
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
 */
export async function getThreadMessages(
  threadId: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const result = await memory.query({
      threadId,
      selectBy: {
        last: limit,
      },
    });
    return result.messages || [];
  } catch (error) {
    console.error("Memory query error:", error);
    return [];
  }
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
  // Fall back to getting recent messages
  // Real semantic search requires embedding model
  console.log(`[memory] Semantic search fallback for: "${query}"`);
  return getThreadMessages(threadId, topK * 2);
}

/**
 * Get memory instance for external use
 */
export function getMemory() {
  return memory;
}
