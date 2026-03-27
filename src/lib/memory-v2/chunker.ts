/**
 * Karya Memory V2 — Text Chunker
 * 
 * Sliding window chunking with overlap for better retrieval
 */

import type { ChunkOptions } from "./types";

export interface Chunk {
  text: string;
  index: number;
  lineStart: number;
  lineEnd: number;
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  chunkSize: 500,
  overlap: 100,
  separator: "\n\n",
};

/**
 * Split text into overlapping chunks
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: Chunk[] = [];
  
  // Split into paragraphs first
  const paragraphs = text.split(opts.separator);
  let currentChunk = "";
  let currentLines: string[] = [];
  let chunkIndex = 0;
  let lineStart = 1;
  let lineNumber = 1;
  
  for (const para of paragraphs) {
    const paraLines = para.split("\n").length;
    
    // If adding this paragraph exceeds chunk size, save current and start new
    if (currentChunk.length + para.length > opts.chunkSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        lineStart,
        lineEnd: lineNumber - 1,
      });
      chunkIndex++;
      
      // Keep overlap from end of previous chunk
      if (opts.overlap > 0) {
        const overlapText = currentChunk.slice(-opts.overlap);
        currentChunk = overlapText + opts.separator + para;
        lineStart = Math.max(1, lineNumber - Math.ceil(paraLines / 2));
      } else {
        currentChunk = para;
        lineStart = lineNumber;
      }
    } else {
      if (currentChunk.length > 0) {
        currentChunk += opts.separator + para;
      } else {
        currentChunk = para;
        lineStart = lineNumber;
      }
    }
    
    lineNumber += paraLines;
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex,
      lineStart,
      lineEnd: lineNumber,
    });
  }
  
  return chunks;
}

/**
 * Smart chunk by markdown sections
 */
export function chunkBySection(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = text.split("\n");
  
  let currentSection = "";
  let currentLines: string[] = [];
  let sectionStart = 1;
  let chunkIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a header (new section)
    if (line.match(/^#{1,3}\s/)) {
      // Save previous section
      if (currentLines.length > 0) {
        chunks.push({
          text: currentLines.join("\n").trim(),
          index: chunkIndex,
          lineStart: sectionStart,
          lineEnd: i,
        });
        chunkIndex++;
      }
      
      currentLines = [line];
      sectionStart = i + 1;
    } else {
      currentLines.push(line);
    }
  }
  
  // Don't forget the last section
  if (currentLines.length > 0) {
    chunks.push({
      text: currentLines.join("\n").trim(),
      index: chunkIndex,
      lineStart: sectionStart,
      lineEnd: lines.length,
    });
  }
  
  return chunks;
}

/**
 * Calculate line number from character position
 */
export function positionToLine(text: string, position: number): number {
  return text.slice(0, position).split("\n").length;
}
