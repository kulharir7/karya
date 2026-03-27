/**
 * Context Compaction — Auto-summarize long conversations
 * 
 * OpenClaw-style compaction with memory flush:
 * 1. When approaching limit, trigger memory flush first
 * 2. Agent writes durable facts to MEMORY.md / daily logs
 * 3. Then compact (summarize old messages)
 * 4. Continue with fresh context + memory files loaded
 */

import { generateText } from "ai";
import { getModel } from "./llm";
import { getMemoryManager } from "./memory-v2";
import { logger } from "./logger";

// Config
const MAX_MESSAGES_BEFORE_COMPACT = 20;
const KEEP_RECENT_MESSAGES = 6;
const MAX_CONTEXT_CHARS = 50000;
const SOFT_THRESHOLD_CHARS = 40000; // Trigger memory flush before hard compact
const MEMORY_FLUSH_ENABLED = true;

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string;
  timestamp?: number;
}

export interface CompactionResult {
  messages: Message[];
  summary: string | null;
  compacted: boolean;
  originalCount: number;
  newCount: number;
  savedChars: number;
}

/**
 * Check if compaction is needed
 */
export function needsCompaction(messages: Message[]): boolean {
  if (messages.length > MAX_MESSAGES_BEFORE_COMPACT) return true;
  
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalChars > MAX_CONTEXT_CHARS) return true;
  
  return false;
}

/**
 * Compact messages by summarizing older ones
 */
export async function compactMessages(
  messages: Message[],
  options: {
    keepRecent?: number;
    model?: string;
  } = {}
): Promise<CompactionResult> {
  const keepRecent = options.keepRecent || KEEP_RECENT_MESSAGES;
  
  // Not enough messages to compact
  if (messages.length <= keepRecent + 2) {
    return {
      messages,
      summary: null,
      compacted: false,
      originalCount: messages.length,
      newCount: messages.length,
      savedChars: 0,
    };
  }
  
  // Split messages
  const oldMessages = messages.slice(0, -keepRecent);
  const recentMessages = messages.slice(-keepRecent);
  
  // Extract key info from old messages
  const toolCalls = oldMessages.filter(m => m.role === "tool" || m.toolName);
  const decisions = oldMessages.filter(m => 
    m.content.toLowerCase().includes("decision") ||
    m.content.toLowerCase().includes("confirmed") ||
    m.content.toLowerCase().includes("completed")
  );
  
  // Generate summary
  const summaryPrompt = `Summarize this conversation history into a compact form.

CONVERSATION:
${oldMessages.map(m => `[${m.role}]: ${m.content.slice(0, 500)}`).join("\n\n")}

RULES:
1. Keep key facts, decisions, and outcomes
2. Mention important tool results briefly
3. Note any user preferences discovered
4. Be concise — aim for 200-400 words
5. Use bullet points for clarity

OUTPUT FORMAT:
## Conversation Summary
- [key points as bullets]

## Decisions Made
- [any decisions or confirmations]

## Tool Results
- [important tool outcomes]`;

  try {
    const llm = getModel();
    
    const result = await generateText({
      model: llm,
      prompt: summaryPrompt,
    });
    
    const summary = result.text;
    
    // Create compacted message array
    const summaryMessage: Message = {
      role: "system",
      content: `[CONTEXT SUMMARY - Previous ${oldMessages.length} messages compacted]\n\n${summary}`,
      timestamp: Date.now(),
    };
    
    const compactedMessages = [summaryMessage, ...recentMessages];
    
    const originalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    const newChars = compactedMessages.reduce((sum, m) => sum + m.content.length, 0);
    
    return {
      messages: compactedMessages,
      summary,
      compacted: true,
      originalCount: messages.length,
      newCount: compactedMessages.length,
      savedChars: originalChars - newChars,
    };
  } catch (err: any) {
    console.error("[compaction] Failed to generate summary:", err.message);
    
    // Fallback: Just keep recent + simple truncation
    const truncatedOld = oldMessages.slice(-3).map(m => ({
      ...m,
      content: m.content.slice(0, 200) + (m.content.length > 200 ? "..." : ""),
    }));
    
    return {
      messages: [...truncatedOld, ...recentMessages],
      summary: null,
      compacted: true,
      originalCount: messages.length,
      newCount: truncatedOld.length + recentMessages.length,
      savedChars: 0,
    };
  }
}

/**
 * Smart compaction — only compact if needed
 */
export async function smartCompact(
  messages: Message[],
  options?: { keepRecent?: number; model?: string }
): Promise<CompactionResult> {
  if (!needsCompaction(messages)) {
    return {
      messages,
      summary: null,
      compacted: false,
      originalCount: messages.length,
      newCount: messages.length,
      savedChars: 0,
    };
  }
  
  return compactMessages(messages, options);
}

/**
 * Extract facts from messages (for memory)
 */
export function extractFacts(messages: Message[]): string[] {
  const facts: string[] = [];
  
  for (const msg of messages) {
    const content = msg.content.toLowerCase();
    
    // User preferences
    if (content.includes("i prefer") || content.includes("i like") || content.includes("i want")) {
      facts.push(`User preference: ${msg.content.slice(0, 100)}`);
    }
    
    // Decisions
    if (content.includes("let's do") || content.includes("go with") || content.includes("confirmed")) {
      facts.push(`Decision: ${msg.content.slice(0, 100)}`);
    }
    
    // File operations
    if (msg.toolName && ["file-write", "file-move", "git-commit"].includes(msg.toolName)) {
      facts.push(`Action: ${msg.toolName} — ${msg.content.slice(0, 50)}`);
    }
  }
  
  return facts.slice(0, 10); // Max 10 facts
}

/**
 * Get compaction stats for a session
 */
export function getCompactionStats(messages: Message[]): {
  messageCount: number;
  totalChars: number;
  needsCompaction: boolean;
  needsMemoryFlush: boolean;
  estimatedTokens: number;
} {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  
  return {
    messageCount: messages.length,
    totalChars,
    needsCompaction: needsCompaction(messages),
    needsMemoryFlush: MEMORY_FLUSH_ENABLED && totalChars > SOFT_THRESHOLD_CHARS && totalChars < MAX_CONTEXT_CHARS,
    estimatedTokens: Math.ceil(totalChars / 4),
  };
}

/**
 * Memory Flush — Save durable facts before compaction
 * 
 * This is OpenClaw's safety net: before context is compacted,
 * we trigger the agent to write important info to memory files.
 */
export async function memoryFlush(
  messages: Message[],
  options: {
    sessionId?: string;
    model?: string;
  } = {}
): Promise<{ flushed: boolean; facts: string[] }> {
  if (!MEMORY_FLUSH_ENABLED) {
    return { flushed: false, facts: [] };
  }

  const stats = getCompactionStats(messages);
  
  // Only flush when approaching threshold
  if (!stats.needsMemoryFlush) {
    return { flushed: false, facts: [] };
  }

  logger.info("compaction", "Memory flush triggered — context approaching limit");

  // Extract facts to save
  const facts = extractFacts(messages);
  
  if (facts.length === 0) {
    return { flushed: false, facts: [] };
  }

  try {
    const memory = getMemoryManager();
    
    // Log facts to today's daily log
    const formattedFacts = facts.map(f => `- ${f}`).join("\n");
    memory.logToday(`## Auto-saved from session (pre-compaction)\n\n${formattedFacts}`);
    
    logger.info("compaction", `Flushed ${facts.length} facts to daily log`);
    
    return { flushed: true, facts };
  } catch (err) {
    logger.error("compaction", "Memory flush failed", err);
    return { flushed: false, facts: [] };
  }
}

/**
 * Smart compaction with memory flush
 * 
 * Flow:
 * 1. Check if approaching limit → trigger memory flush
 * 2. Check if over limit → compact
 * 3. Return updated messages
 */
export async function smartCompactWithFlush(
  messages: Message[],
  options?: { keepRecent?: number; model?: string; sessionId?: string }
): Promise<CompactionResult & { memoryFlushed: boolean }> {
  // Step 1: Memory flush if approaching threshold
  const flushResult = await memoryFlush(messages, {
    sessionId: options?.sessionId,
    model: options?.model,
  });

  // Step 2: Compact if needed
  const compactResult = await smartCompact(messages, options);

  return {
    ...compactResult,
    memoryFlushed: flushResult.flushed,
  };
}

/**
 * Generate memory flush prompt for agent
 * 
 * Use this to inject a system message that reminds the agent
 * to save important info before compaction.
 */
export function getMemoryFlushPrompt(): string {
  const date = new Date().toISOString().split("T")[0];
  
  return `[SYSTEM: Context approaching compaction threshold]

Before continuing, save any important information that should persist:
1. Use memory-write to update MEMORY.md with lasting facts
2. Use memory-log to record today's key events in memory/${date}.md
3. Note any user preferences, decisions, or project status

If nothing important to save, continue normally.`;
}
