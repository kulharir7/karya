/**
 * Karya Memory V2 — Vector Store
 * 
 * SQLite-based vector storage with cosine similarity
 * Uses simple in-memory cosine similarity (can upgrade to sqlite-vec later)
 */

import { createClient, type Client } from "@libsql/client";
import type { MemoryEntry } from "./types";

// Embedding dimension (depends on model)
const EMBEDDING_DIM = 384; // MiniLM default

export interface VectorEntry {
  id: string;
  embedding: number[];
}

export class VectorStore {
  private db: Client;
  private initialized = false;
  private embedder: ((text: string) => Promise<number[]>) | null = null;

  constructor(dbPath: string) {
    this.db = createClient({
      url: `file:${dbPath}`,
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // Create vector table (store as JSON blob for simplicity)
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS memory_vectors (
        id TEXT PRIMARY KEY,
        source TEXT,
        embedding TEXT,
        content TEXT,
        line_start INTEGER,
        line_end INTEGER,
        chunk_index INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);

    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_vectors_source ON memory_vectors(source)
    `);

    this.initialized = true;
  }

  /**
   * Set the embedding function
   */
  setEmbedder(fn: (text: string) => Promise<number[]>): void {
    this.embedder = fn;
  }

  /**
   * Index a memory entry with its embedding
   */
  async index(entry: MemoryEntry, embedding?: number[]): Promise<void> {
    await this.init();

    // Get embedding if not provided
    let emb = embedding;
    if (!emb && this.embedder) {
      emb = await this.embedder(entry.content);
    }

    if (!emb) {
      console.warn("[vector-store] No embedding for entry:", entry.id);
      return;
    }

    // Delete existing
    await this.db.execute({
      sql: "DELETE FROM memory_vectors WHERE id = ?",
      args: [entry.id],
    });

    // Insert
    await this.db.execute({
      sql: `INSERT INTO memory_vectors 
            (id, source, embedding, content, line_start, line_end, chunk_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        entry.id,
        entry.source,
        JSON.stringify(emb),
        entry.content,
        entry.lineStart,
        entry.lineEnd,
        entry.chunkIndex,
        entry.createdAt,
        entry.updatedAt,
      ],
    });
  }

  /**
   * Search by vector similarity
   */
  async search(queryEmbedding: number[], limit: number = 10): Promise<Array<{ entry: MemoryEntry; score: number }>> {
    await this.init();

    // Get all vectors (for small datasets, this is fine)
    const result = await this.db.execute("SELECT * FROM memory_vectors");

    // Calculate cosine similarity for each
    const scored = result.rows.map((row) => {
      const embedding = JSON.parse(row.embedding as string) as number[];
      const score = cosineSimilarity(queryEmbedding, embedding);

      return {
        entry: {
          id: row.id as string,
          source: row.source as string,
          content: row.content as string,
          lineStart: row.line_start as number,
          lineEnd: row.line_end as number,
          chunkIndex: row.chunk_index as number,
          createdAt: row.created_at as number,
          updatedAt: row.updated_at as number,
        },
        score,
      };
    });

    // Sort by score descending and limit
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Search by text (uses embedder)
   */
  async searchByText(query: string, limit: number = 10): Promise<Array<{ entry: MemoryEntry; score: number }>> {
    if (!this.embedder) {
      console.warn("[vector-store] No embedder set, returning empty results");
      return [];
    }

    const queryEmbedding = await this.embedder(query);
    return this.search(queryEmbedding, limit);
  }

  /**
   * Delete entries by source
   */
  async deleteBySource(source: string): Promise<void> {
    await this.init();
    await this.db.execute({
      sql: "DELETE FROM memory_vectors WHERE source = ?",
      args: [source],
    });
  }

  /**
   * Clear all
   */
  async clear(): Promise<void> {
    await this.init();
    await this.db.execute("DELETE FROM memory_vectors");
  }

  /**
   * Get count
   */
  async count(): Promise<number> {
    await this.init();
    const result = await this.db.execute("SELECT COUNT(*) as cnt FROM memory_vectors");
    return result.rows[0].cnt as number;
  }
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Euclidean distance (alternative metric)
 */
function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}
