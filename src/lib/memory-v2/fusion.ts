/**
 * Karya Memory V2 — Score Fusion
 * 
 * Combines vector similarity (cosine) with FTS5 (BM25) scores
 * Formula: finalScore = vectorWeight * cosineSim + textWeight * normalizedBM25
 */

import type { MemoryEntry, SearchResult, SearchOptions } from "./types";

export interface VectorResult {
  entry: MemoryEntry;
  score: number; // cosine similarity (0-1)
}

export interface FTSResult {
  entry: MemoryEntry;
  rank: number; // BM25 rank (lower is better)
}

/**
 * Fuse vector and FTS results into unified ranked list
 */
export function fuseResults(
  vectorResults: VectorResult[],
  ftsResults: FTSResult[],
  options: {
    vectorWeight?: number;
    textWeight?: number;
    maxResults?: number;
    minScore?: number;
  } = {}
): SearchResult[] {
  const {
    vectorWeight = 0.6,
    textWeight = 0.4,
    maxResults = 10,
    minScore = 0.1,
  } = options;

  // Create maps for quick lookup
  const vectorMap = new Map<string, VectorResult>();
  const ftsMap = new Map<string, FTSResult>();

  for (const vr of vectorResults) {
    vectorMap.set(vr.entry.id, vr);
  }

  for (const fr of ftsResults) {
    ftsMap.set(fr.entry.id, fr);
  }

  // Get all unique IDs
  const allIds = new Set([...vectorMap.keys(), ...ftsMap.keys()]);

  // Calculate fused scores
  const results: SearchResult[] = [];

  for (const id of allIds) {
    const vr = vectorMap.get(id);
    const fr = ftsMap.get(id);

    // Get entry from whichever result has it
    const entry = vr?.entry || fr?.entry;
    if (!entry) continue;

    // Vector score (already 0-1)
    const vectorScore = vr?.score || 0;

    // Normalize BM25 rank to 0-1 score
    // BM25 rank: lower is better, so we invert it
    // Using formula: score = 1 / (1 + rank) for rank >= 0
    // For negative ranks (FTS5 uses negative BM25), we use: score = 1 / (1 + abs(rank))
    const textScore = fr ? 1 / (1 + Math.abs(fr.rank)) : 0;

    // Fused score
    const score = vectorWeight * vectorScore + textWeight * textScore;

    // Skip low scores
    if (score < minScore) continue;

    results.push({
      entry,
      score,
      vectorScore,
      textScore,
      snippet: createSnippet(entry.content, 200),
    });
  }

  // Sort by fused score descending
  results.sort((a, b) => b.score - a.score);

  // Limit results
  return results.slice(0, maxResults);
}

/**
 * Reciprocal Rank Fusion (RRF) - alternative fusion method
 * Better for combining multiple ranked lists
 */
export function reciprocalRankFusion(
  vectorResults: VectorResult[],
  ftsResults: FTSResult[],
  k: number = 60, // smoothing constant
  maxResults: number = 10
): SearchResult[] {
  // Calculate RRF scores
  const rrfScores = new Map<string, { score: number; entry: MemoryEntry; vectorScore: number; textScore: number }>();

  // Add vector results
  for (let i = 0; i < vectorResults.length; i++) {
    const vr = vectorResults[i];
    const rrf = 1 / (k + i + 1);
    
    rrfScores.set(vr.entry.id, {
      score: rrf,
      entry: vr.entry,
      vectorScore: vr.score,
      textScore: 0,
    });
  }

  // Add FTS results
  for (let i = 0; i < ftsResults.length; i++) {
    const fr = ftsResults[i];
    const rrf = 1 / (k + i + 1);
    
    const existing = rrfScores.get(fr.entry.id);
    if (existing) {
      existing.score += rrf;
      existing.textScore = 1 / (1 + Math.abs(fr.rank));
    } else {
      rrfScores.set(fr.entry.id, {
        score: rrf,
        entry: fr.entry,
        vectorScore: 0,
        textScore: 1 / (1 + Math.abs(fr.rank)),
      });
    }
  }

  // Convert to results and sort
  const results: SearchResult[] = Array.from(rrfScores.values())
    .map((r) => ({
      entry: r.entry,
      score: r.score,
      vectorScore: r.vectorScore,
      textScore: r.textScore,
      snippet: createSnippet(r.entry.content, 200),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return results;
}

/**
 * Create a snippet from content
 */
function createSnippet(content: string, maxLength: number = 200): string {
  if (content.length <= maxLength) return content;

  // Try to break at word boundary
  const truncated = content.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + "...";
  }

  return truncated + "...";
}

/**
 * Highlight query terms in snippet
 */
export function highlightSnippet(snippet: string, query: string): string {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  let highlighted = snippet;

  for (const term of terms) {
    const regex = new RegExp(`(${escapeRegex(term)})`, "gi");
    highlighted = highlighted.replace(regex, "**$1**");
  }

  return highlighted;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
