/**
 * Karya Memory V2 — Types
 */

export interface MemoryEntry {
  id: string;
  source: string;        // file path (MEMORY.md, memory/2026-03-28.md)
  content: string;       // the text
  lineStart: number;     // line number in file
  lineEnd: number;
  chunkIndex: number;    // chunk number within file
  createdAt: number;     // timestamp
  updatedAt: number;
}

export interface SearchResult {
  entry: MemoryEntry;
  score: number;         // fused score (0-1)
  vectorScore: number;   // cosine similarity
  textScore: number;     // BM25 normalized
  snippet: string;       // highlighted excerpt
}

export interface SearchOptions {
  query: string;
  maxResults?: number;   // default 10
  minScore?: number;     // default 0.1
  sources?: string[];    // filter by source files
  vectorWeight?: number; // default 0.6
  textWeight?: number;   // default 0.4
}

export interface ChunkOptions {
  chunkSize?: number;    // chars per chunk, default 500
  overlap?: number;      // overlap between chunks, default 100
  separator?: string;    // split on (default: paragraph)
}

export interface MemoryConfig {
  workspacePath: string;
  vectorDbPath: string;
  ftsDbPath: string;
  chunkOptions: ChunkOptions;
  searchDefaults: Partial<SearchOptions>;
  autoIndex: boolean;    // auto-reindex on file change
}
