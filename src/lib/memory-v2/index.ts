/**
 * Karya Memory V2 — Hybrid Memory System
 * 
 * OpenClaw-inspired memory with:
 * - File-based storage (MEMORY.md, daily logs)
 * - Vector search (cosine similarity)
 * - FTS5 search (BM25)
 * - Score fusion (weighted combination)
 * 
 * Files are truth, indices are derived.
 */

import * as path from "path";
import { VectorStore } from "./vector-store";
import { FTSStore } from "./fts-store";
import { WorkspaceManager } from "./workspace";
import { chunkText, chunkBySection } from "./chunker";
import { fuseResults, reciprocalRankFusion } from "./fusion";
import type { MemoryEntry, SearchResult, SearchOptions, MemoryConfig } from "./types";
import { logger } from "../logger";

export * from "./types";
export { WorkspaceManager } from "./workspace";

const DEFAULT_CONFIG: MemoryConfig = {
  workspacePath: path.join(process.cwd(), "workspace"),
  vectorDbPath: path.join(process.cwd(), "data", "karya-vectors.db"),
  ftsDbPath: path.join(process.cwd(), "data", "karya-fts.db"),
  chunkOptions: {
    chunkSize: 500,
    overlap: 100,
  },
  searchDefaults: {
    maxResults: 10,
    minScore: 0.1,
    vectorWeight: 0.6,
    textWeight: 0.4,
  },
  autoIndex: true,
};

export class MemoryManager {
  private config: MemoryConfig;
  private vectorStore: VectorStore;
  private ftsStore: FTSStore;
  private workspace: WorkspaceManager;
  private embedder: ((text: string) => Promise<number[]>) | null = null;
  private indexed = false;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Ensure data directory exists
    const dataDir = path.dirname(this.config.vectorDbPath);
    const fs = require("fs");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.vectorStore = new VectorStore(this.config.vectorDbPath);
    this.ftsStore = new FTSStore(this.config.ftsDbPath);
    this.workspace = new WorkspaceManager(this.config.workspacePath);
  }

  /**
   * Set the embedding function
   */
  setEmbedder(fn: (text: string) => Promise<number[]>): void {
    this.embedder = fn;
    this.vectorStore.setEmbedder(fn);
  }

  /**
   * Index all workspace files
   */
  async indexAll(): Promise<{ indexed: number; files: number }> {
    const files = this.workspace.getAllFiles();
    let indexed = 0;

    for (const file of files) {
      const chunks = chunkBySection(file.content);
      
      for (const chunk of chunks) {
        if (chunk.text.trim().length < 10) continue;

        const entry: MemoryEntry = {
          id: `${file.name}:${chunk.index}`,
          source: file.name,
          content: chunk.text,
          lineStart: chunk.lineStart,
          lineEnd: chunk.lineEnd,
          chunkIndex: chunk.index,
          createdAt: file.modifiedAt,
          updatedAt: file.modifiedAt,
        };

        // Index in FTS
        await this.ftsStore.index(entry);

        // Index in vector store (if embedder available)
        if (this.embedder) {
          try {
            await this.vectorStore.index(entry);
          } catch (err) {
            logger.warn("memory-v2", `Failed to embed chunk: ${entry.id}`, err);
          }
        }

        indexed++;
      }
    }

    this.indexed = true;
    logger.info("memory-v2", `Indexed ${indexed} chunks from ${files.length} files`);

    return { indexed, files: files.length };
  }

  /**
   * Reindex a specific file
   */
  async reindexFile(relativePath: string): Promise<number> {
    const content = this.workspace.readFile(relativePath);
    if (!content) return 0;

    // Delete old entries
    await this.ftsStore.deleteBySource(relativePath);
    await this.vectorStore.deleteBySource(relativePath);

    // Chunk and reindex
    const chunks = chunkBySection(content);
    let indexed = 0;
    const now = Date.now();

    for (const chunk of chunks) {
      if (chunk.text.trim().length < 10) continue;

      const entry: MemoryEntry = {
        id: `${relativePath}:${chunk.index}`,
        source: relativePath,
        content: chunk.text,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
        chunkIndex: chunk.index,
        createdAt: now,
        updatedAt: now,
      };

      await this.ftsStore.index(entry);
      if (this.embedder) {
        await this.vectorStore.index(entry);
      }
      indexed++;
    }

    return indexed;
  }

  /**
   * Search memory with hybrid fusion
   */
  async search(query: string, options: Partial<SearchOptions> = {}): Promise<SearchResult[]> {
    const opts = { ...this.config.searchDefaults, ...options };

    // Ensure indexed
    if (!this.indexed && this.config.autoIndex) {
      await this.indexAll();
    }

    // FTS search (always available)
    const ftsResults = await this.ftsStore.search(query, (opts.maxResults || 10) * 2);

    // Vector search (if embedder available)
    let vectorResults: Array<{ entry: MemoryEntry; score: number }> = [];
    if (this.embedder) {
      vectorResults = await this.vectorStore.searchByText(query, (opts.maxResults || 10) * 2);
    }

    // Fuse results
    const fused = fuseResults(
      vectorResults,
      ftsResults,
      {
        vectorWeight: opts.vectorWeight,
        textWeight: opts.textWeight,
        maxResults: opts.maxResults,
        minScore: opts.minScore,
      }
    );

    return fused;
  }

  /**
   * Simple keyword search (FTS only)
   */
  async keywordSearch(query: string, limit: number = 10): Promise<SearchResult[]> {
    const results = await this.ftsStore.search(query, limit);
    
    return results.map(r => ({
      entry: r.entry,
      score: 1 / (1 + Math.abs(r.rank)),
      vectorScore: 0,
      textScore: 1 / (1 + Math.abs(r.rank)),
      snippet: r.entry.content.slice(0, 200),
    }));
  }

  /**
   * Semantic search (vector only)
   */
  async semanticSearch(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.embedder) {
      logger.warn("memory-v2", "No embedder set, falling back to keyword search");
      return this.keywordSearch(query, limit);
    }

    const results = await this.vectorStore.searchByText(query, limit);
    
    return results.map(r => ({
      entry: r.entry,
      score: r.score,
      vectorScore: r.score,
      textScore: 0,
      snippet: r.entry.content.slice(0, 200),
    }));
  }

  /**
   * Get workspace context for agent
   */
  getContext(): string {
    return this.workspace.getContext();
  }

  /**
   * Log to today's daily file
   */
  logToday(entry: string): void {
    this.workspace.logToday(entry);
  }

  /**
   * Append to long-term memory
   */
  appendToMemory(content: string): void {
    this.workspace.appendToLongTermMemory(content);
  }

  /**
   * Get recent daily logs
   */
  getRecentLogs(days: number = 7) {
    return this.workspace.getRecentLogs(days);
  }

  /**
   * Read a workspace file
   */
  readFile(relativePath: string): string | null {
    return this.workspace.readFile(relativePath);
  }

  /**
   * Write to a workspace file
   */
  writeFile(relativePath: string, content: string): void {
    this.workspace.writeFile(relativePath, content);
    
    // Reindex if auto-index enabled
    if (this.config.autoIndex) {
      this.reindexFile(relativePath).catch(err => {
        logger.warn("memory-v2", `Auto-reindex failed for ${relativePath}`, err);
      });
    }
  }

  /**
   * Get index stats
   */
  async getStats(): Promise<{ ftsCount: number; vectorCount: number; files: number }> {
    const files = this.workspace.getAllFiles();
    const ftsCount = await this.ftsStore.count();
    const vectorCount = await this.vectorStore.count();

    return { ftsCount, vectorCount, files: files.length };
  }

  /**
   * Clear all indices
   */
  async clearIndices(): Promise<void> {
    await this.ftsStore.clear();
    await this.vectorStore.clear();
    this.indexed = false;
  }
}

// Singleton instance
let memoryManagerInstance: MemoryManager | null = null;

export function getMemoryManager(config?: Partial<MemoryConfig>): MemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager(config);
  }
  return memoryManagerInstance;
}

export async function initMemoryManager(
  config?: Partial<MemoryConfig>,
  embedder?: (text: string) => Promise<number[]>
): Promise<MemoryManager> {
  const manager = getMemoryManager(config);
  
  if (embedder) {
    manager.setEmbedder(embedder);
  }
  
  await manager.indexAll();
  return manager;
}
