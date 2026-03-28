/**
 * Karya Semantic Memory — RAG-based conversation recall
 * 
 * Phase 8.5: Fixed fastembed build issue.
 * 
 * Problem: @mastra/fastembed → @anush008/tokenizers is a non-ESM native module
 * that breaks `next build` (Turbopack can't handle it).
 * 
 * Solution: All fastembed imports are dynamic with full error suppression.
 * If fastembed fails → silently fall back to basic memory (no vectors).
 * Build never breaks.
 * 
 * Priority: OpenAI embeddings > FastEmbed (local) > Basic (no vectors)
 */

import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import * as path from "path";
import * as fs from "fs";

// Database paths
const DB_DIR = path.join(process.cwd(), "data");
const STORAGE_DB = path.join(DB_DIR, "karya-memory.db");
const VECTOR_DB = path.join(DB_DIR, "karya-vectors.db");

// Ensure data directory
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// ============================================
// MEMORY FACTORIES
// ============================================

/**
 * Create memory with optional embedder for vector search.
 */
function createMemoryWithEmbedder(embedder?: any): Memory {
  const storage = new LibSQLStore({
    id: "karya-storage",
    url: `file:${STORAGE_DB}`,
  });

  const hasEmbedder = !!embedder;

  const vector = hasEmbedder
    ? new LibSQLVector({ id: "karya-vector", url: `file:${VECTOR_DB}` })
    : undefined;

  return new Memory({
    storage,
    vector,
    embedder,
    options: {
      lastMessages: 20,
      semanticRecall: hasEmbedder
        ? { topK: 5, messageRange: 2, scope: "resource" as const }
        : false,
    },
  });
}

/**
 * Basic memory — no vector search, just recent messages.
 * Always works, no external dependencies.
 */
export function createBasicMemory(): Memory {
  return createMemoryWithEmbedder(undefined);
}

/**
 * Try OpenAI embeddings (requires OPENAI_API_KEY).
 */
async function tryOpenAIMemory(): Promise<Memory | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const { ModelRouterEmbeddingModel } = await import("@mastra/core/llm");
    const embedder = new ModelRouterEmbeddingModel("openai/text-embedding-3-small");
    return createMemoryWithEmbedder(embedder);
  } catch {
    return null;
  }
}

/**
 * Try FastEmbed (local, no API key).
 * FULLY DYNAMIC — if @mastra/fastembed fails to load, returns null silently.
 * This is the fix for the build issue.
 */
async function tryFastEmbedMemory(): Promise<Memory | null> {
  try {
    // Dynamic import with eval to prevent Turbopack/webpack from tracing
    const mod = await (new Function('return import("@mastra/fastembed")'))();
    const embedder = mod?.fastembed || mod?.default?.fastembed;
    if (!embedder) return null;
    return createMemoryWithEmbedder(embedder);
  } catch {
    // FastEmbed not available — totally fine, fall back to basic
    return null;
  }
}

/**
 * Get the best available memory.
 * Priority: OpenAI > FastEmbed > Basic
 */
export async function getBestMemory(): Promise<Memory> {
  // 1. OpenAI
  const openai = await tryOpenAIMemory();
  if (openai) return openai;

  // 2. FastEmbed (local)
  const fastembed = await tryFastEmbedMemory();
  if (fastembed) return fastembed;

  // 3. Basic
  return createBasicMemory();
}

// ============================================
// SINGLETON
// ============================================

let memoryInstance: Memory | null = null;

export async function getMemoryInstance(): Promise<Memory> {
  if (!memoryInstance) {
    memoryInstance = await getBestMemory();
  }
  return memoryInstance;
}

// ============================================
// RECALL HELPERS
// ============================================

/**
 * Semantic search across threads.
 */
export async function semanticRecall(
  memory: Memory,
  threadId: string,
  query: string,
  options?: { topK?: number; messageRange?: number }
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
  } catch {
    return [];
  }
}
