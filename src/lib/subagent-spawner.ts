/**
 * Sub-Agent Spawner — Parallel agent execution
 * 
 * Like OpenClaw's sessions_spawn:
 * - Spawn isolated sub-agents for parallel work
 * - Each sub-agent has its own context
 * - Parent waits for results or monitors progress
 * - Sub-agents can be steered/killed
 */

import { generateText, streamText } from "ai";
import { getModel } from "./llm";
import { eventBus } from "./event-bus";

// Sub-agent status
export type SubAgentStatus = "running" | "completed" | "failed" | "killed";

export interface SubAgent {
  id: string;
  parentSessionId: string;
  task: string;
  status: SubAgentStatus;
  createdAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
  messages: Array<{ role: string; content: string }>;
}

// Active sub-agents registry
const subAgents: Map<string, SubAgent> = new Map();

/**
 * Generate unique ID
 */
function generateId(): string {
  return `subagent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Spawn a new sub-agent
 */
export async function spawnSubAgent(
  parentSessionId: string,
  task: string,
  options: {
    timeout?: number; // ms, default 60000
    context?: string; // additional context
    model?: string;
    onProgress?: (chunk: string) => void;
  } = {}
): Promise<SubAgent> {
  const id = generateId();
  const timeout = options.timeout || 60000;
  
  const subAgent: SubAgent = {
    id,
    parentSessionId,
    task,
    status: "running",
    createdAt: Date.now(),
    messages: [],
  };
  
  subAgents.set(id, subAgent);
  
  eventBus.emit("subagent:spawned" as any, {
    id,
    parentSessionId,
    task,
  });
  
  // Build prompt
  const systemPrompt = `You are a focused sub-agent working on a specific task.
Your parent agent has delegated this task to you.

TASK: ${task}

${options.context ? `CONTEXT:\n${options.context}\n` : ""}

RULES:
1. Focus ONLY on this task
2. Be concise and direct
3. Return actionable results
4. If you cannot complete the task, explain why

Complete the task and provide your results.`;

  // Execute with timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Sub-agent timeout")), timeout);
  });
  
  try {
    const llm = getModel();
    
    const resultPromise = generateText({
      model: llm,
      system: systemPrompt,
      prompt: task,
    });
    
    const result = await Promise.race([resultPromise, timeoutPromise]);
    
    subAgent.status = "completed";
    subAgent.completedAt = Date.now();
    subAgent.result = result.text;
    subAgent.messages.push(
      { role: "user", content: task },
      { role: "assistant", content: result.text }
    );
    
    eventBus.emit("subagent:completed" as any, {
      id,
      result: result.text,
      duration: Date.now() - subAgent.createdAt,
    });
    
  } catch (err: any) {
    subAgent.status = "failed";
    subAgent.completedAt = Date.now();
    subAgent.error = err.message;
    
    eventBus.emit("subagent:failed" as any, {
      id,
      error: err.message,
    });
  }
  
  return subAgent;
}

/**
 * Spawn multiple sub-agents in parallel
 */
export async function spawnParallel(
  parentSessionId: string,
  tasks: Array<{ task: string; context?: string }>,
  options: {
    timeout?: number;
    maxConcurrent?: number;
  } = {}
): Promise<SubAgent[]> {
  const maxConcurrent = options.maxConcurrent || 5;
  const results: SubAgent[] = [];
  
  // Process in batches
  for (let i = 0; i < tasks.length; i += maxConcurrent) {
    const batch = tasks.slice(i, i + maxConcurrent);
    
    const batchResults = await Promise.all(
      batch.map(({ task, context }) =>
        spawnSubAgent(parentSessionId, task, {
          timeout: options.timeout,
          context,
        })
      )
    );
    
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Get sub-agent by ID
 */
export function getSubAgent(id: string): SubAgent | undefined {
  return subAgents.get(id);
}

/**
 * List sub-agents for a parent session
 */
export function listSubAgents(parentSessionId?: string): SubAgent[] {
  const all = Array.from(subAgents.values());
  
  if (parentSessionId) {
    return all.filter(sa => sa.parentSessionId === parentSessionId);
  }
  
  return all;
}

/**
 * List running sub-agents
 */
export function listRunningSubAgents(): SubAgent[] {
  return Array.from(subAgents.values()).filter(sa => sa.status === "running");
}

/**
 * Kill a sub-agent (mark as killed, can't actually stop execution)
 */
export function killSubAgent(id: string): boolean {
  const subAgent = subAgents.get(id);
  if (!subAgent || subAgent.status !== "running") return false;
  
  subAgent.status = "killed";
  subAgent.completedAt = Date.now();
  subAgent.error = "Killed by parent";
  
  eventBus.emit("subagent:killed" as any, { id });
  
  return true;
}

/**
 * Steer a sub-agent (send additional instruction)
 */
export async function steerSubAgent(
  id: string,
  instruction: string
): Promise<SubAgent | null> {
  const subAgent = subAgents.get(id);
  if (!subAgent || subAgent.status !== "running") return null;
  
  // Add instruction to messages
  subAgent.messages.push({ role: "user", content: instruction });
  
  // Continue conversation
  try {
    const llm = getModel();
    
    const result = await generateText({
      model: llm,
      messages: subAgent.messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });
    
    subAgent.messages.push({ role: "assistant", content: result.text });
    subAgent.result = result.text;
    
    return subAgent;
  } catch (err: any) {
    subAgent.error = err.message;
    return subAgent;
  }
}

/**
 * Wait for sub-agent to complete
 */
export async function waitForSubAgent(
  id: string,
  timeoutMs: number = 120000
): Promise<SubAgent | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const subAgent = subAgents.get(id);
    if (!subAgent) return null;
    
    if (subAgent.status !== "running") {
      return subAgent;
    }
    
    // Poll every 500ms
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Timeout
  const subAgent = subAgents.get(id);
  if (subAgent && subAgent.status === "running") {
    subAgent.status = "failed";
    subAgent.error = "Wait timeout";
  }
  
  return subAgent || null;
}

/**
 * Wait for all sub-agents to complete
 */
export async function waitForAll(
  ids: string[],
  timeoutMs: number = 120000
): Promise<SubAgent[]> {
  const results = await Promise.all(
    ids.map(id => waitForSubAgent(id, timeoutMs))
  );
  
  return results.filter((sa): sa is SubAgent => sa !== null);
}

/**
 * Clean up old completed sub-agents (older than 1 hour)
 */
export function cleanupSubAgents(maxAgeMs: number = 3600000): number {
  const cutoff = Date.now() - maxAgeMs;
  let count = 0;
  
  for (const [id, subAgent] of subAgents.entries()) {
    if (subAgent.status !== "running" && subAgent.createdAt < cutoff) {
      subAgents.delete(id);
      count++;
    }
  }
  
  return count;
}

/**
 * Get sub-agent stats
 */
export function getSubAgentStats(): {
  total: number;
  running: number;
  completed: number;
  failed: number;
  killed: number;
} {
  const all = Array.from(subAgents.values());
  
  return {
    total: all.length,
    running: all.filter(sa => sa.status === "running").length,
    completed: all.filter(sa => sa.status === "completed").length,
    failed: all.filter(sa => sa.status === "failed").length,
    killed: all.filter(sa => sa.status === "killed").length,
  };
}
