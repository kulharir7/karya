/**
 * Karya Agent Router — LLM-based intelligent routing.
 * 
 * Uses the actual LLM to classify which specialist agent should handle a task.
 * No keyword matching. The model THINKS and decides.
 */

export type AgentType = "supervisor" | "browser" | "file" | "coder" | "researcher" | "data-analyst";

interface RouteResult {
  agent: AgentType;
  confidence: number;
  reason: string;
}

const VALID_AGENTS: AgentType[] = ["supervisor", "browser", "file", "coder", "researcher", "data-analyst"];

const ROUTING_PROMPT = `You are an intelligent task router. Given a user message, decide which specialist agent should handle it.

Available agents:
- **browser**: Web browsing, opening websites, searching online, filling forms, scraping web data, booking flights/hotels, checking prices on Amazon/Flipkart, any task involving a web browser.
- **file**: File/folder operations — reading, writing, moving, renaming, searching files, ZIP/PDF handling, image resizing, checking folder contents, disk size.
- **coder**: Programming tasks — writing code, creating apps/projects/scripts, debugging, git operations, npm/pip commands, running shell commands, building software, creating multi-file projects.
- **researcher**: Information lookup — "what is X?", comparing things, finding facts, news, reviews, explaining concepts, deep research on topics.
- **data-analyst**: Data processing — analyzing CSV/JSON files, statistics, calculations, data transformation, parsing spreadsheets, creating charts from data.
- **supervisor**: General conversation, greetings, simple questions, multi-domain tasks that need coordination, or anything that doesn't clearly fit above.

Rules:
1. If the task involves CREATING/BUILDING an app, project, website, or writing code → coder
2. If it involves opening a URL or interacting with a website → browser
3. If it's about files on the computer (not creating code) → file
4. If the user asks "what is X" or wants information → researcher
5. If it involves analyzing data from files → data-analyst
6. If unclear or simple chat → supervisor

Respond with ONLY a JSON object, nothing else:
{"agent": "<agent_name>", "confidence": <0.0-1.0>, "reason": "<brief reason>"}`;

// LLM-based routing cache (avoid re-routing same messages)
const routeCache: Map<string, { result: RouteResult; timestamp: number }> = new Map();
const CACHE_TTL = 300_000; // 5 minutes

/**
 * Route a message using the LLM to classify intent.
 * Falls back to simple heuristics if LLM fails.
 */
export async function routeMessage(message: string): Promise<RouteResult> {
  // Check cache first
  const cacheKey = message.toLowerCase().trim();
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  try {
    // Use the LLM for routing
    const result = await llmRoute(message);
    routeCache.set(cacheKey, { result, timestamp: Date.now() });
    
    // Cleanup old cache entries
    if (routeCache.size > 200) {
      const oldest = [...routeCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 50);
      oldest.forEach(([key]) => routeCache.delete(key));
    }

    return result;
  } catch (err) {
    console.error("[Router] LLM routing failed, using fallback:", err);
    return fallbackRoute(message);
  }
}

/**
 * LLM-based routing — asks the model to classify the task.
 */
async function llmRoute(message: string): Promise<RouteResult> {
  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const { generateText } = await import("ai");

  const provider = createOpenAICompatible({
    name: "router",
    baseURL: process.env.LLM_BASE_URL || "https://ollama.com/v1",
    apiKey: process.env.LLM_API_KEY || "ollama",
  });

  const model = provider(process.env.LLM_MODEL || "gpt-oss:120b");

  const { text } = await (generateText as any)({
    model,
    system: ROUTING_PROMPT,
    prompt: `User message: "${message}"`,
    maxTokens: 150,
    temperature: 0,
  });

  // Parse JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON in LLM response: " + text.slice(0, 200));
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const agent = VALID_AGENTS.includes(parsed.agent) ? parsed.agent : "supervisor";
  const confidence = typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.8;
  const reason = parsed.reason || "LLM classification";

  return { agent, confidence, reason };
}

/**
 * Fallback heuristic routing — used when LLM fails.
 * Simple but reliable patterns.
 */
function fallbackRoute(message: string): RouteResult {
  const m = message.toLowerCase();

  // URL or domain detection
  if (/https?:\/\/|www\.|\.com|\.org|\.net|\.io|\.in/.test(m) || /open\s+\w+\.(com|org|net|io|in)/.test(m)) {
    return { agent: "browser", confidence: 0.9, reason: "URL/domain detected (fallback)" };
  }

  // Code/build patterns
  if (/(?:banao|bana|create|build|make|write)\s+.*(?:app|project|website|script|code|program)/.test(m) ||
      /(?:app|project|website|script)\s+(?:banao|bana|create|build)/.test(m) ||
      /(?:git|npm|pip|python|javascript|typescript|html|react)/.test(m)) {
    return { agent: "coder", confidence: 0.85, reason: "Code/build pattern (fallback)" };
  }

  // File patterns
  if (/(?:file|folder|directory|desktop|downloads|documents)\s+(?:pe|mein|me|par|check|dikhao|list)/.test(m) ||
      /\.(txt|pdf|csv|json|zip|doc|xls|jpg|png)/.test(m)) {
    return { agent: "file", confidence: 0.85, reason: "File operation pattern (fallback)" };
  }

  // Data patterns
  if (/(?:csv|data|analyze|statistics|calculate|parse)/.test(m)) {
    return { agent: "data-analyst", confidence: 0.8, reason: "Data pattern (fallback)" };
  }

  // Research patterns
  if (/(?:what is|who is|explain|tell me about|research|compare)/.test(m)) {
    return { agent: "researcher", confidence: 0.75, reason: "Research pattern (fallback)" };
  }

  return { agent: "supervisor", confidence: 1, reason: "General task (fallback)" };
}

/**
 * Get all available agent types with descriptions.
 */
export function listAgentTypes(): { id: AgentType; name: string; description: string }[] {
  return [
    { id: "supervisor", name: "Supervisor", description: "Orchestrates all agents, handles complex multi-domain tasks" },
    { id: "browser", name: "Browser Agent", description: "Web browsing, site interaction, data extraction from websites" },
    { id: "file", name: "File Agent", description: "File/folder management, PDF, images, archives" },
    { id: "coder", name: "Coder Agent", description: "Code writing, execution, analysis, git operations" },
    { id: "researcher", name: "Researcher", description: "Web research, information synthesis, fact-finding" },
    { id: "data-analyst", name: "Data Analyst", description: "CSV/JSON parsing, statistics, data transformation" },
  ];
}
