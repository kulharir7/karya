/**
 * Karya Memory V2 — FTS5 Full-Text Search Store
 * 
 * SQLite FTS5 for BM25-based keyword search
 */

import { createClient, type Client } from "@libsql/client";
import type { MemoryEntry } from "./types";
import * as path from "path";

export class FTSStore {
  private db: Client;
  private initialized = false;

  constructor(dbPath: string) {
    this.db = createClient({
      url: `file:${dbPath}`,
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // Create FTS5 virtual table
    await this.db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        id,
        source,
        content,
        line_start,
        line_end,
        chunk_index,
        tokenize = 'porter unicode61'
      )
    `);

    // Create metadata table for timestamps
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS memory_meta (
        id TEXT PRIMARY KEY,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);

    this.initialized = true;
  }

  /**
   * Index a memory entry
   */
  async index(entry: MemoryEntry): Promise<void> {
    await this.init();

    // Delete existing entry with same id
    await this.db.execute({
      sql: "DELETE FROM memory_fts WHERE id = ?",
      args: [entry.id],
    });

    await this.db.execute({
      sql: "DELETE FROM memory_meta WHERE id = ?",
      args: [entry.id],
    });

    // Insert into FTS
    await this.db.execute({
      sql: `INSERT INTO memory_fts (id, source, content, line_start, line_end, chunk_index)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [entry.id, entry.source, entry.content, entry.lineStart, entry.lineEnd, entry.chunkIndex],
    });

    // Insert metadata
    await this.db.execute({
      sql: `INSERT INTO memory_meta (id, created_at, updated_at) VALUES (?, ?, ?)`,
      args: [entry.id, entry.createdAt, entry.updatedAt],
    });
  }

  /**
   * Search using BM25
   * Returns entries with BM25 rank (lower is better match)
   */
  async search(query: string, limit: number = 10): Promise<Array<{ entry: MemoryEntry; rank: number }>> {
    await this.init();

    // FTS5 search with BM25 ranking
    const result = await this.db.execute({
      sql: `
        SELECT 
          f.id, f.source, f.content, f.line_start, f.line_end, f.chunk_index,
          m.created_at, m.updated_at,
          bm25(memory_fts) as rank
        FROM memory_fts f
        LEFT JOIN memory_meta m ON f.id = m.id
        WHERE memory_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `,
      args: [query, limit],
    });

    return result.rows.map((row) => ({
      entry: {
        id: row.id as string,
        source: row.source as string,
        content: row.content as string,
        lineStart: row.line_start as number,
        lineEnd: row.line_end as number,
        chunkIndex: row.chunk_index as number,
        createdAt: row.created_at as number || Date.now(),
        updatedAt: row.updated_at as number || Date.now(),
      },
      rank: row.rank as number,
    }));
  }

  /**
   * Delete entries by source file
   */
  async deleteBySource(source: string): Promise<void> {
    await this.init();

    // Get IDs first
    const result = await this.db.execute({
      sql: "SELECT id FROM memory_fts WHERE source = ?",
      args: [source],
    });

    for (const row of result.rows) {
      await this.db.execute({
        sql: "DELETE FROM memory_fts WHERE id = ?",
        args: [row.id as string],
      });
      await this.db.execute({
        sql: "DELETE FROM memory_meta WHERE id = ?",
        args: [row.id as string],
      });
    }
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    await this.init();
    await this.db.execute("DELETE FROM memory_fts");
    await this.db.execute("DELETE FROM memory_meta");
  }

  /**
   * Get entry count
   */
  async count(): Promise<number> {
    await this.init();
    const result = await this.db.execute("SELECT COUNT(*) as cnt FROM memory_fts");
    return result.rows[0].cnt as number;
  }
}
