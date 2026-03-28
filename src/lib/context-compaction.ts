/**
 * Context Compaction — Auto-summarize long conversations
 * 
 * Phase 8.1: REWRITTEN and integrated into ChatProcessor.
 * 
 * Problem: ChatProcessor loads last 20 messages. If sessions are long,
 * early context is lost. If we load more, we hit token limits.
 * 
 * Solution: When token count is high, summarize older messages into a
 * compact summary and keep only recent messages + summary.
 * 
 * Flow in ChatProcessor:
 *   1. Load last 20 messages from DB
 *   2. Estimate token count
 *   3. If over threshold → compact older messages into summary
 *   4. Insert summary as system message + keep recent messages
 *   5. Agent gets: workspace context → summary → recent chat → new message
 * 
 * Compaction also saves key facts to daily memory log (memory flush)
 * so important info survives even after summary.
 * 
 * No external dependencies — uses getModel() for summary, logToDaily() for flush.
 * Does NOT use memory-v2/fastembed (avoids build issue).
 */

import { generateText } from "ai";
import { getModel } from "./llm";
import { logToDaily } from "./memory-engine";
import { logger } from "./logger";

// ============================================
// CONFIG
// ============================================

/** Max estimated tokens before compaction triggers */
const TOKEN_THRESHOLD = 12000;

/** Keep this many recent messages after compaction */
const KEEP_RECENT = 8;

/** Minimum messages before compaction can happen */
const MIN_MESSAGES_FOR_COMPACTION = 12;

/** Max tokens for the summary itself */
const MAX_SUMMARY_TOKENS = 500;

// ============================================
// TYPES
// ============================================

export interface ContextMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CompactionResult {
  messages: ContextMessage[];
  compacted: boolean;
  originalCount: number;
  newCount: number;
  savedTokens: number;
  summary: string | null;
  factsFlushed: number;
}

// ============================================
// TOKEN ESTIMATION
// ============================================

/**
 * Rough token estimate: ~4 chars per token for English.
 * Good enough for deciding when to compact (not billing).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateMessagesTokens(messages: ContextMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0); // +4 for role/separator overhead
}

// ============================================
// MAIN: SMART COMPACT
// ============================================

/**
 * Check if messages need compaction and do it if needed.
 * 
 * Call this in ChatProcessor AFTER loading messages, BEFORE building context.
 * 
 * Returns the (possibly compacted) message array.
 */
export async function compactIfNeeded(
  messages: ContextMessage[],
  sessionId?: string
): Promise<CompactionResult> {
  const tokenCount = estimateMessagesTokens(messages);

  // Not enough messages or tokens — skip
  if (messages.length < MIN_MESSAGES_FOR_COMPACTION || tokenCount < TOKEN_THRESHOLD) {
    return {
      messages,
      compacted: false,
      originalCount: messages.length,
      newCount: messages.length,
      savedTokens: 0,
      summary: null,
      factsFlushed: 0,
    };
  }

  logger.info(
    "compaction",
    `Compacting: ${messages.length} messages, ~${tokenCount} tokens (threshold: ${TOKEN_THRESHOLD})`
  );

  // Split: old messages to summarize, recent to keep
  const oldMessages = messages.slice(0, -KEEP_RECENT);
  const recentMessages = messages.slice(-KEEP_RECENT);

  // ---- Step 1: Extract and flush key facts to daily memory ----
  const facts = extractKeyFacts(oldMessages);
  if (facts.length > 0 && sessionId) {
    try {
      logToDaily(`## Auto-saved before context compaction (${sessionId})\n${facts.map((f) => `- ${f}`).join("\n")}`);
    } catch {
      // Non-critical
    }
  }

  // ---- Step 2: Generate summary of old messages ----
  let summary: string | null = null;

  try {
    summary = await generateSummary(oldMessages);
  } catch (err: any) {
    logger.warn("compaction", `Summary generation failed: ${err.message}`);
    // Fallback: simple truncation
    summary = createFallbackSummary(oldMessages);
  }

  // ---- Step 3: Build compacted message array ----
  const compactedMessages: ContextMessage[] = [];

  if (summary) {
    compactedMessages.push({
      role: "system",
      content: `[CONVERSATION SUMMARY — ${oldMessages.length} earlier messages compacted]\n\n${summary}`,
    });
  }

  compactedMessages.push(...recentMessages);

  const newTokenCount = estimateMessagesTokens(compactedMessages);

  logger.info(
    "compaction",
    `Compacted: ${messages.length} → ${compactedMessages.length} messages, ~${tokenCount} → ~${newTokenCount} tokens`
  );

  return {
    messages: compactedMessages,
    compacted: true,
    originalCount: messages.length,
    newCount: compactedMessages.length,
    savedTokens: tokenCount - newTokenCount,
    summary,
    factsFlushed: facts.length,
  };
}

// ============================================
// SUMMARY GENERATION
// ============================================

async function generateSummary(messages: ContextMessage[]): Promise<string> {
  // Build conversation text (truncated per message to save tokens)
  const conversationText = messages
    .map((m) => {
      const prefix = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System";
      const content = m.content.length > 300 ? m.content.slice(0, 300) + "..." : m.content;
      return `[${prefix}]: ${content}`;
    })
    .join("\n\n");

  const prompt = `Summarize this conversation into a compact reference. This summary will be used as context for continuing the conversation.

CONVERSATION (${messages.length} messages):
${conversationText}

RULES:
1. Keep key facts, decisions, file paths, and outcomes
2. Mention tool results briefly (what was done, not raw output)
3. Note user preferences or style requests
4. Be concise — max 300 words
5. Use bullet points

FORMAT:
## Summary
- [bullet points of key information]

## Actions Taken
- [what tools were used and results]

## Status
- [current state of whatever was being worked on]`;

  const llm = getModel();
  const result = await generateText({
    model: llm as any,
    prompt,
    maxOutputTokens: MAX_SUMMARY_TOKENS,
  });

  return result.text.trim();
}

/**
 * Fallback summary when LLM call fails.
 * Just keeps the last few messages of the old batch, truncated.
 */
function createFallbackSummary(messages: ContextMessage[]): string {
  const lastFew = messages.slice(-4);
  const lines = lastFew.map((m) => {
    const prefix = m.role === "user" ? "User" : "Assistant";
    return `- [${prefix}]: ${m.content.slice(0, 150)}${m.content.length > 150 ? "..." : ""}`;
  });

  return `## Summary (auto-truncated, ${messages.length} messages)\n${lines.join("\n")}`;
}

// ============================================
// FACT EXTRACTION (for memory flush)
// ============================================

function extractKeyFacts(messages: ContextMessage[]): string[] {
  const facts: string[] = [];

  for (const msg of messages) {
    const content = msg.content;
    const lower = content.toLowerCase();

    // User preferences
    if (lower.includes("i prefer") || lower.includes("i like") || lower.includes("i want") || lower.includes("mujhe")) {
      facts.push(`Preference: ${content.slice(0, 120)}`);
    }

    // Decisions
    if (lower.includes("let's do") || lower.includes("go with") || lower.includes("confirmed") || lower.includes("theek hai") || lower.includes("done")) {
      if (msg.role === "user") {
        facts.push(`Decision: ${content.slice(0, 120)}`);
      }
    }

    // File paths mentioned
    const pathMatch = content.match(/[A-Z]:\\[^\s"',]+|\/[a-z][^\s"',]+/i);
    if (pathMatch && msg.role === "assistant") {
      facts.push(`Path mentioned: ${pathMatch[0]}`);
    }

    // Errors encountered
    if (lower.includes("error") || lower.includes("failed") || lower.includes("fix")) {
      if (msg.role === "assistant" && content.length < 200) {
        facts.push(`Issue: ${content.slice(0, 120)}`);
      }
    }
  }

  // Deduplicate and limit
  const unique = [...new Set(facts)];
  return unique.slice(0, 10);
}

// ============================================
// STATS (for dashboard/API)
// ============================================

export function getCompactionStats(messages: ContextMessage[]): {
  messageCount: number;
  estimatedTokens: number;
  needsCompaction: boolean;
  threshold: number;
} {
  const tokens = estimateMessagesTokens(messages);
  return {
    messageCount: messages.length,
    estimatedTokens: tokens,
    needsCompaction: messages.length >= MIN_MESSAGES_FOR_COMPACTION && tokens >= TOKEN_THRESHOLD,
    threshold: TOKEN_THRESHOLD,
  };
}
