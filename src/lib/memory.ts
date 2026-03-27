/**
 * Karya Memory System — Semantic Recall with Vector Search
 * 
 * Uses Mastra's official Memory class with:
 * - LibSQLStore for message storage
 * - LibSQLVector for vector embeddings
 * - FastEmbed for local embeddings (no API key needed)
 */

import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import { fastembed } from "@mastra/fastembed";

// Storage for messages
const storage = new LibSQLStore({
  id: "karya-storage",
  url: "file:karya-memory.db",
});

// Vector DB for semantic search
const vector = new LibSQLVector({
  id: "karya-vector",
  url: "file:karya-memory.db", // Same DB file for simplicity
});

// Create memory with semantic recall enabled
export const memory = new Memory({
  storage,
  vector,
  // Use FastEmbed for LOCAL embeddings (no API key required!)
  embedder: fastembed,
  options: {
    // Recent message history
    lastMessages: 20,
    // Semantic recall configuration
    semanticRecall: {
      topK: 5,           // Retrieve 5 most similar messages
      messageRange: 2,   // Include 2 messages before/after each match
      scope: "thread",   // Search within current thread (or "resource" for all threads)
    },
  },
});

/**
 * Search memory semantically
 * Returns messages similar to the query
 */
export async function semanticSearch(
  threadId: string,
  query: string,
  topK: number = 5
): Promise<any[]> {
  try {
    const result = await memory.recall({
      threadId,
      vectorSearchString: query,
      threadConfig: {
        semanticRecall: {
          topK,
          messageRange: 2,
        },
      },
    });
    return result.messages || [];
  } catch (error) {
    console.error("Semantic search error:", error);
    return [];
  }
}

/**
 * Get memory instance for external use
 */
export function getMemory() {
  return memory;
}
