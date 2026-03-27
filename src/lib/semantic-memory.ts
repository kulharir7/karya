/**
 * Karya Semantic Memory — RAG-based conversation recall
 * 
 * Uses Mastra Memory with:
 * - LibSQL for storage
 * - Vector embeddings for semantic search
 * - Configurable recall settings
 */

import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import * as path from "path";

// Database paths
const DB_DIR = path.join(process.cwd(), "data");
const STORAGE_DB = path.join(DB_DIR, "karya-memory.db");
const VECTOR_DB = path.join(DB_DIR, "karya-vectors.db");

// Ensure data directory exists
import * as fs from "fs";
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

/**
 * Create semantic memory with vector search
 * 
 * Note: For embeddings, you can use:
 * - OpenAI: 'openai/text-embedding-3-small' (requires OPENAI_API_KEY)
 * - FastEmbed: local embeddings (no API key needed)
 * - Default: falls back to disabled semantic recall if no embedder configured
 */
export function createSemanticMemory(options?: {
  embedder?: any;
  topK?: number;
  messageRange?: number;
}): Memory {
  const storage = new LibSQLStore({
    id: "karya-storage",
    url: `file:${STORAGE_DB}`,
  });

  const vector = new LibSQLVector({
    id: "karya-vector",
    url: `file:${VECTOR_DB}`,
  });

  // Check if embedder is provided
  const hasEmbedder = !!options?.embedder;

  return new Memory({
    storage,
    vector: hasEmbedder ? vector : undefined,
    embedder: options?.embedder,
    options: {
      // Recent message history
      lastMessages: 20,
      // Semantic recall config
      semanticRecall: hasEmbedder
        ? {
            topK: options?.topK || 5, // How many similar messages to retrieve
            messageRange: options?.messageRange || 2, // Context around each match
            scope: "resource", // Search across all threads for user
          }
        : false, // Disabled if no embedder
    },
  });
}

/**
 * Get memory without embeddings (faster, no vector search)
 */
export function createBasicMemory(): Memory {
  const storage = new LibSQLStore({
    id: "karya-storage",
    url: `file:${STORAGE_DB}`,
  });

  return new Memory({
    storage,
    options: {
      lastMessages: 20,
      semanticRecall: false,
    },
  });
}

/**
 * Create memory with OpenAI embeddings
 * Requires OPENAI_API_KEY environment variable
 */
export async function createOpenAIMemory(): Promise<Memory | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.log("[semantic-memory] No OPENAI_API_KEY found, using basic memory");
    return null;
  }

  try {
    // Dynamic import to avoid bundling issues
    const { ModelRouterEmbeddingModel } = await import("@mastra/core/llm");
    
    const embedder = new ModelRouterEmbeddingModel("openai/text-embedding-3-small");
    return createSemanticMemory({ embedder, topK: 5, messageRange: 2 });
  } catch (err) {
    console.error("[semantic-memory] Failed to create OpenAI memory:", err);
    return null;
  }
}

/**
 * Create memory with FastEmbed (local, no API key needed)
 */
export async function createFastEmbedMemory(): Promise<Memory | null> {
  try {
    // Dynamic import
    const { fastembed } = await import("@mastra/fastembed");
    return createSemanticMemory({ embedder: fastembed, topK: 5, messageRange: 2 });
  } catch (err) {
    console.log("[semantic-memory] FastEmbed not available, using basic memory");
    return null;
  }
}

/**
 * Get the best available memory
 * Priority: OpenAI > FastEmbed > Basic
 */
export async function getBestMemory(): Promise<Memory> {
  // Try OpenAI first
  const openaiMemory = await createOpenAIMemory();
  if (openaiMemory) {
    console.log("[semantic-memory] Using OpenAI embeddings");
    return openaiMemory;
  }

  // Try FastEmbed
  const fastembedMemory = await createFastEmbedMemory();
  if (fastembedMemory) {
    console.log("[semantic-memory] Using FastEmbed (local)");
    return fastembedMemory;
  }

  // Fallback to basic
  console.log("[semantic-memory] Using basic memory (no embeddings)");
  return createBasicMemory();
}

/**
 * Semantic search across threads
 */
export async function semanticRecall(
  memory: Memory,
  threadId: string,
  query: string,
  options?: {
    topK?: number;
    messageRange?: number;
  }
): Promise<any[]> {
  try {
    const result = await memory.recall({
      threadId,
      vectorSearchString: query,
      threadConfig: {
        semanticRecall: {
          topK: options?.topK || 5,
          messageRange: options?.messageRange || 2,
        },
      },
    });
    
    return result.messages || [];
  } catch (err) {
    console.error("[semantic-memory] Recall failed:", err);
    return [];
  }
}

/**
 * Get recent messages from a thread
 */
export async function getRecentMessages(
  memory: Memory,
  threadId: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const result = await memory.recall({
      threadId,
      perPage: limit,
    });
    
    return result.messages || [];
  } catch (err) {
    console.error("[semantic-memory] getRecentMessages failed:", err);
    return [];
  }
}

// Export singleton instance
let memoryInstance: Memory | null = null;

export async function getMemoryInstance(): Promise<Memory> {
  if (!memoryInstance) {
    memoryInstance = await getBestMemory();
  }
  return memoryInstance;
}
