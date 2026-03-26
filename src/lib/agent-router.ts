/**
 * Agent Router — determines which specialist agent should handle a task.
 * 
 * Like OpenClaw's binding system but for internal routing.
 * Supervisor uses this to delegate to the right specialist.
 * 
 * Routing is keyword-based + intent classification.
 * Falls back to supervisor for ambiguous or multi-domain tasks.
 */

export type AgentType = "supervisor" | "browser" | "file" | "coder" | "researcher" | "data-analyst";

interface RouteResult {
  agent: AgentType;
  confidence: number; // 0-1
  reason: string;
}

// Keyword patterns for each agent
const ROUTE_PATTERNS: Record<AgentType, { keywords: string[]; patterns: RegExp[] }> = {
  browser: {
    keywords: [
      "website", "webpage", "url", "http", "browse", "navigate", "click",
      "google", "search online", "web search", "open site", "amazon",
      "flipkart", "youtube", "facebook", "twitter", "linkedin",
      "makemytrip", "booking", "form fill", "login", "signup",
      "screenshot", "page", "scrape", "extract from web",
      "kholo", "site", "kholna", "browser",
      "flight", "hotel", "train", "bus",
    ],
    patterns: [
      /open\s+(https?:\/\/|www\.)/i,
      /open\s+\w+\.(com|org|net|in|io|co)/i,
      /go\s+to\s+\w+/i,
      /\w+\.(com|org|net|in|io)\b/i,   // any domain name
      /search\s+(on|for|google|online)/i,
      /(?:website|site|page)\s+(?:pe|par|se|ka)/i,
      /(?:flight|hotel|train|bus)\s+(?:check|book|search|dekh|find|compare)/i,
      /(?:check|book|search|find|compare)\s+(?:flight|hotel|train|bus)/i,
      /(?:delhi|mumbai|bangalore|kolkata|chennai)\s+(?:to|se)\s+/i,
      /(?:to|se)\s+(?:delhi|mumbai|bangalore|kolkata|chennai)/i,
      /(?:kholo|kholna|open)\s+/i,
    ],
  },
  file: {
    keywords: [
      "file", "folder", "directory", "desktop", "downloads", "documents",
      "read file", "write file", "create file", "delete file", "move file",
      "rename", "copy", "zip", "unzip", "compress", "extract",
      "pdf", "image", "resize", "batch rename", "size",
      "kya files", "file banao", "file dhundho", "folder mein",
    ],
    patterns: [
      /(?:read|open|show|dikhao)\s+(?:file|folder)/i,
      /(?:create|banao|write|likho)\s+(?:file|folder)/i,
      /(?:move|rename|copy)\s+(?:file|folder)/i,
      /(?:C:|D:|E:|F:)[\\/]/i, // Windows paths
      /\.(txt|pdf|csv|json|md|jpg|png|zip|doc|xls)/i,
      /(?:desktop|downloads?|documents?)\s+(?:pe|mein|me|par)/i,
      /(?:kitna|size|kitni)\s+(?:bada|badi|size|space)/i,
    ],
  },
  coder: {
    keywords: [
      "code", "program", "script", "function", "class", "variable",
      "javascript", "typescript", "python", "html", "css", "react",
      "node", "npm", "pip", "git", "github", "compile", "build",
      "debug", "error", "bug", "fix", "refactor", "test",
      "api", "server", "database", "algorithm",
      "code likho", "script banao", "program chalao",
    ],
    patterns: [
      /(?:write|create|make|banao)\s+(?:a\s+)?(?:code|script|program|function)/i,
      /(?:run|execute|chalao)\s+(?:code|script|command)/i,
      /(?:debug|fix|solve)\s+(?:error|bug|issue)/i,
      /(?:install|setup)\s+(?:npm|pip|package|node)/i,
      /(?:git|github)\s+(?:clone|pull|push|commit|status)/i,
      /(?:analyze|review)\s+(?:code|file|project)/i,
    ],
  },
  researcher: {
    keywords: [
      "research", "find out", "learn about", "what is", "who is",
      "explain", "tell me about", "information", "facts",
      "news", "latest", "trending", "compare", "difference between",
      "pros and cons", "review", "best", "top 10",
    ],
    patterns: [
      /(?:what|who|when|where|why|how)\s+(?:is|are|was|were|do|does)\s+\w+\s+\w+/i,  // needs more context
      /(?:find|search|look up|research)\s+(?:about|for|info)/i,
      /(?:compare|difference|versus|vs)\s+/i,
      /(?:explain|describe|tell\s+me)\s+(?:about|what)\s+\w+/i,
      /(?:best|top|latest|trending)\s+\w+\s+\w+/i,  // "best restaurants in Delhi"
    ],
  },
  "data-analyst": {
    keywords: [
      "csv", "data", "analyze", "analysis", "statistics", "stats",
      "spreadsheet", "excel", "table", "chart", "graph",
      "calculate", "sum", "average", "count", "filter", "sort",
      "transform", "convert", "json query", "parse",
      "data dikhao", "analyze karo", "calculate karo",
    ],
    patterns: [
      /(?:analyze|parse|process)\s+(?:csv|data|json|file)/i,
      /(?:calculate|compute|count)\s+/i,
      /(?:filter|sort|group)\s+(?:by|data|records)/i,
      /(?:convert|transform)\s+(?:csv|json|data)/i,
      /\.csv\b/i,
      /(?:statistics|stats|summary)\s+(?:of|for|from)/i,
    ],
  },
  supervisor: {
    keywords: [], // Fallback — handles everything else
    patterns: [],
  },
};

/**
 * Route a message to the best specialist agent.
 * Returns the agent type, confidence score, and reasoning.
 */
export function routeMessage(message: string): RouteResult {
  const msgLower = message.toLowerCase();
  const scores: Record<AgentType, number> = {
    browser: 0, file: 0, coder: 0, researcher: 0,
    "data-analyst": 0, supervisor: 0,
  };

  // Score each agent
  for (const [agentType, { keywords, patterns }] of Object.entries(ROUTE_PATTERNS)) {
    if (agentType === "supervisor") continue;

    // Keyword matching
    for (const kw of keywords) {
      if (msgLower.includes(kw.toLowerCase())) {
        scores[agentType as AgentType] += 2;
      }
    }

    // Pattern matching (higher weight)
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        scores[agentType as AgentType] += 5;
      }
    }
  }

  // Find the highest scoring agent
  let bestAgent: AgentType = "supervisor";
  let bestScore = 0;

  for (const [agent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent as AgentType;
    }
  }

  // Confidence calculation
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? bestScore / totalScore : 0;

  // If confidence is too low or scores are close, use supervisor
  if (bestScore < 3 || confidence < 0.4) {
    return {
      agent: "supervisor",
      confidence: 1,
      reason: "General task — supervisor handles directly",
    };
  }

  const reasons: Record<AgentType, string> = {
    browser: "Web browsing / website interaction detected",
    file: "File or folder operation detected",
    coder: "Programming / code task detected",
    researcher: "Research / information lookup detected",
    "data-analyst": "Data analysis / processing detected",
    supervisor: "General task",
  };

  return {
    agent: bestAgent,
    confidence: Math.round(confidence * 100) / 100,
    reason: reasons[bestAgent],
  };
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
