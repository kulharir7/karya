/**
 * Karya Security Engine — Centralized enforcement for ALL tool executions
 * 
 * Phase 7.1: The REAL security layer.
 * 
 * WHY THIS APPROACH:
 * Mastra's agent.stream() executes tools INTERNALLY. By the time ChatProcessor
 * receives tool-call/tool-result events, the tool has ALREADY run. We can't
 * intercept in the stream.
 * 
 * SOLUTION: Every dangerous tool calls securityCheck() at the START of its
 * execute() function. If denied → return error to agent instead of executing.
 * 
 * THREE LAYERS:
 * 1. COMMAND GUARD: Blocks dangerous shell commands (rm -rf, format, etc.)
 * 2. PATH GUARD: Blocks file access outside allowed paths
 * 3. RATE LIMITER: Per-tool execution limits (shell: 10/min, file-write: 30/min)
 * 
 * Plus:
 * - Audit logging: every tool call recorded
 * - Blocked attempt logging: denied executions tracked
 * - Security config: workspace/security.json (editable)
 * - Event bus integration: security:blocked, security:allowed events
 */

import * as fs from "fs";
import * as path from "path";
import { eventBus } from "./event-bus";
import { logger } from "./logger";

// ============================================
// TYPES
// ============================================

export type RiskLevel = "safe" | "moderate" | "dangerous";

export interface SecurityCheckResult {
  allowed: boolean;
  risk: RiskLevel;
  reason?: string;
  /** If blocked, what category blocked it */
  blockedBy?: "command-guard" | "path-guard" | "rate-limit" | "tool-blocked" | "config";
}

export interface SecurityConfig {
  /** Master switch — disable all security checks (development only!) */
  enabled: boolean;

  /** Tools that are completely blocked (never execute) */
  blockedTools: string[];

  /** Dangerous shell command patterns (regex strings) */
  blockedCommands: string[];

  /** Blocked path prefixes (file tools can't access these) */
  blockedPaths: string[];

  /** Allowed path prefixes (if restrictToAllowed=true, ONLY these are accessible) */
  allowedPaths: string[];

  /** If true, file tools can ONLY access allowedPaths. If false, everything except blockedPaths. */
  restrictToAllowed: boolean;

  /** Per-tool rate limits (calls per minute). 0 = unlimited. */
  rateLimits: Record<string, number>;

  /** Max shell command execution time in seconds */
  maxShellTimeoutSeconds: number;
}

// ============================================
// DEFAULT CONFIG
// ============================================

const DEFAULT_CONFIG: SecurityConfig = {
  enabled: true,

  blockedTools: [],

  blockedCommands: [
    // Disk destruction
    "^format\\s", "^fdisk\\s", "^diskpart",
    // Recursive delete of root/system
    "rm\\s+-rf\\s+/\\s*$", "rm\\s+-rf\\s+/\\*",
    "del\\s+/s\\s+/q\\s+C:\\\\\\s*$",
    "Remove-Item\\s+-Recurse.*C:\\\\Windows",
    "Remove-Item\\s+-Recurse.*C:\\\\Program",
    // Registry modification
    "^reg\\s+delete", "^reg\\s+add.*HKLM",
    // User management
    "^net\\s+user\\s+.*\\/add", "^net\\s+localgroup\\s+admin",
    // Encoded/obfuscated commands (common attack vector)
    "powershell.*-[Ee]nc\\s", "powershell.*-[Ee]ncodedCommand",
    // Pipe to shell (remote code execution)
    "curl.*\\|\\s*sh", "curl.*\\|\\s*bash",
    "wget.*\\|\\s*sh", "wget.*\\|\\s*bash",
    "iex\\s*\\(.*Net\\.WebClient",
    // System modification
    "^bcdedit", "^bootrec",
    // Credential theft
    "mimikatz", "credential.*dump",
  ],

  blockedPaths: [
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\ProgramData",
    "C:\\Recovery",
    "C:\\$Recycle.Bin",
    // Linux equivalents
    "/etc/passwd", "/etc/shadow",
    "/usr/bin", "/usr/sbin",
    "/boot", "/proc", "/sys",
  ],

  allowedPaths: [
    // Will be auto-populated with user's common directories
  ],

  restrictToAllowed: false,

  rateLimits: {
    "shell-execute": 15,
    "file-write": 40,
    "file-delete": 5,
    "file-move": 20,
    "kill-process": 5,
    "git-push": 5,
    "git-commit": 10,
    "api-call": 20,
    "system-screenshot": 10,
    "code-execute": 15,
  },

  maxShellTimeoutSeconds: 60,
};

// ============================================
// STATE
// ============================================

const CONFIG_FILE = path.join(process.cwd(), "workspace", "security.json");
let config: SecurityConfig = { ...DEFAULT_CONFIG };
let configLoaded = false;

/** Rate limit tracking: toolName → { timestamps[] } */
const rateBuckets = new Map<string, number[]>();

/** Blocked attempts log (last 200) */
const blockedLog: Array<{
  timestamp: number;
  tool: string;
  reason: string;
  blockedBy: string;
  args?: any;
}> = [];
const MAX_BLOCKED_LOG = 200;

// ============================================
// CONFIG LOADING
// ============================================

/**
 * Load security config from workspace/security.json.
 * Creates default config if file doesn't exist.
 */
export function loadSecurityConfig(): SecurityConfig {
  if (configLoaded) return config;

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const loaded = JSON.parse(raw);
      config = { ...DEFAULT_CONFIG, ...loaded };
    } else {
      // Create default config file
      saveSecurityConfig(DEFAULT_CONFIG);
      config = { ...DEFAULT_CONFIG };
    }
  } catch (err: any) {
    logger.warn("security", `Failed to load config, using defaults: ${err.message}`);
    config = { ...DEFAULT_CONFIG };
  }

  configLoaded = true;
  return config;
}

/**
 * Save security config to disk.
 */
export function saveSecurityConfig(newConfig: Partial<SecurityConfig>): void {
  config = { ...config, ...newConfig };
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (err: any) {
    logger.warn("security", `Failed to save config: ${err.message}`);
  }
}

/**
 * Get current security config.
 */
export function getSecurityConfig(): SecurityConfig {
  return loadSecurityConfig();
}

// ============================================
// MAIN CHECK FUNCTIONS
// ============================================

/**
 * Check if a COMMAND is safe to execute.
 * Called by shell-execute and code-execute tools.
 * 
 * Returns { allowed, risk, reason } — if not allowed, the tool should
 * return the reason as an error to the agent.
 */
export function checkCommand(command: string): SecurityCheckResult {
  const cfg = loadSecurityConfig();
  if (!cfg.enabled) return { allowed: true, risk: "dangerous" };

  const cmdLower = command.toLowerCase().trim();

  // Check against blocked patterns
  for (const pattern of cfg.blockedCommands) {
    try {
      const regex = new RegExp(pattern, "i");
      if (regex.test(command) || regex.test(cmdLower)) {
        const result: SecurityCheckResult = {
          allowed: false,
          risk: "dangerous",
          reason: `Blocked command pattern: ${pattern}`,
          blockedBy: "command-guard",
        };
        logBlocked("shell-execute", result.reason!, "command-guard", { command: command.slice(0, 200) });
        return result;
      }
    } catch {
      // Invalid regex in config — skip
    }
  }

  // Classify risk level
  const risk = classifyCommandRisk(cmdLower);

  return { allowed: true, risk };
}

/**
 * Check if a FILE PATH is safe to access.
 * Called by file-read, file-write, file-move, file-delete tools.
 */
export function checkPath(filePath: string, operation: "read" | "write" | "delete" = "read"): SecurityCheckResult {
  const cfg = loadSecurityConfig();
  if (!cfg.enabled) return { allowed: true, risk: "safe" };

  // Normalize path
  const normalized = path.resolve(filePath).replace(/\\/g, "/");
  const normalizedLower = normalized.toLowerCase();

  // Block path traversal
  if (filePath.includes("..")) {
    const result: SecurityCheckResult = {
      allowed: false,
      risk: "dangerous",
      reason: `Path traversal detected: ${filePath}`,
      blockedBy: "path-guard",
    };
    logBlocked("file-access", result.reason!, "path-guard", { path: filePath, operation });
    return result;
  }

  // Check blocked paths
  for (const blocked of cfg.blockedPaths) {
    const blockedNorm = blocked.replace(/\\/g, "/").toLowerCase();
    if (normalizedLower.startsWith(blockedNorm)) {
      const result: SecurityCheckResult = {
        allowed: false,
        risk: "dangerous",
        reason: `Blocked path: ${filePath} (matches ${blocked})`,
        blockedBy: "path-guard",
      };
      logBlocked("file-access", result.reason!, "path-guard", { path: filePath, operation });
      return result;
    }
  }

  // If restrictToAllowed, check allowedPaths
  if (cfg.restrictToAllowed && cfg.allowedPaths.length > 0) {
    const isAllowed = cfg.allowedPaths.some((allowed) => {
      const allowedNorm = allowed.replace(/\\/g, "/").toLowerCase();
      return normalizedLower.startsWith(allowedNorm);
    });

    if (!isAllowed) {
      const result: SecurityCheckResult = {
        allowed: false,
        risk: "moderate",
        reason: `Path not in allowlist: ${filePath}`,
        blockedBy: "path-guard",
      };
      logBlocked("file-access", result.reason!, "path-guard", { path: filePath, operation });
      return result;
    }
  }

  // Classify risk based on operation
  const risk: RiskLevel = operation === "read" ? "safe" : operation === "delete" ? "dangerous" : "moderate";

  return { allowed: true, risk };
}

/**
 * Check per-tool rate limit.
 * Called at the start of any rate-limited tool execution.
 */
export function checkRateLimit(toolName: string): SecurityCheckResult {
  const cfg = loadSecurityConfig();
  if (!cfg.enabled) return { allowed: true, risk: "safe" };

  const limit = cfg.rateLimits[toolName];
  if (!limit || limit <= 0) return { allowed: true, risk: "safe" };

  const now = Date.now();
  const windowMs = 60_000; // 1 minute window
  const windowStart = now - windowMs;

  let timestamps = rateBuckets.get(toolName) || [];
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    const result: SecurityCheckResult = {
      allowed: false,
      risk: "moderate",
      reason: `Rate limit: ${toolName} exceeded ${limit}/minute (${timestamps.length} calls)`,
      blockedBy: "rate-limit",
    };
    logBlocked(toolName, result.reason!, "rate-limit");
    return result;
  }

  timestamps.push(now);
  rateBuckets.set(toolName, timestamps);
  return { allowed: true, risk: "safe" };
}

/**
 * Check if a tool is blocked entirely.
 */
export function checkToolBlocked(toolName: string): SecurityCheckResult {
  const cfg = loadSecurityConfig();
  if (!cfg.enabled) return { allowed: true, risk: "safe" };

  if (cfg.blockedTools.includes(toolName)) {
    const result: SecurityCheckResult = {
      allowed: false,
      risk: "dangerous",
      reason: `Tool "${toolName}" is blocked by security policy`,
      blockedBy: "tool-blocked",
    };
    logBlocked(toolName, result.reason!, "tool-blocked");
    return result;
  }

  return { allowed: true, risk: "safe" };
}

/**
 * COMBINED CHECK — Run all applicable checks for a tool.
 * This is the main entry point for tools to call.
 * 
 * Usage in any tool:
 *   const check = fullSecurityCheck("shell-execute", { command: "rm -rf /" });
 *   if (!check.allowed) return { success: false, error: check.reason };
 */
export function fullSecurityCheck(
  toolName: string,
  context?: { command?: string; path?: string; operation?: "read" | "write" | "delete" }
): SecurityCheckResult {
  // 1. Tool blocked?
  const toolCheck = checkToolBlocked(toolName);
  if (!toolCheck.allowed) return toolCheck;

  // 2. Rate limit?
  const rateCheck = checkRateLimit(toolName);
  if (!rateCheck.allowed) return rateCheck;

  // 3. Command guard? (for shell tools)
  if (context?.command) {
    const cmdCheck = checkCommand(context.command);
    if (!cmdCheck.allowed) return cmdCheck;
  }

  // 4. Path guard? (for file tools)
  if (context?.path) {
    const pathCheck = checkPath(context.path, context.operation || "read");
    if (!pathCheck.allowed) return pathCheck;
  }

  return { allowed: true, risk: "safe" };
}

// ============================================
// COMMAND RISK CLASSIFICATION
// ============================================

function classifyCommandRisk(cmd: string): RiskLevel {
  // Safe: read-only commands
  const safePatterns = [
    /^(dir|ls|cat|type|echo|date|whoami|hostname|pwd|cd|where|which)\s/,
    /^git\s+(status|log|diff|branch|remote|show)/,
    /^npm\s+(list|ls|view|info|outdated)/,
    /^node\s+(-v|--version)/,
    /^python\s+(-V|--version|-c\s+"print)/,
    /^curl\s+-s/,
  ];

  for (const pattern of safePatterns) {
    if (pattern.test(cmd)) return "safe";
  }

  // Dangerous: write/destructive commands
  const dangerousPatterns = [
    /^(rm|del|remove-item|erase)\s/i,
    /^(kill|taskkill|stop-process)\s/i,
    /^git\s+(push|reset\s+--hard|rebase|force)/i,
    /^npm\s+(publish|unpublish)/i,
    /^(shutdown|restart|reboot)\s/i,
    /^(chmod|chown|icacls)\s/i,
    /^(net\s+stop|sc\s+stop|service\s+stop)/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(cmd)) return "dangerous";
  }

  // Default: moderate
  return "moderate";
}

// ============================================
// BLOCKED LOG
// ============================================

function logBlocked(tool: string, reason: string, blockedBy: string, args?: any): void {
  blockedLog.push({
    timestamp: Date.now(),
    tool,
    reason,
    blockedBy,
    args,
  });

  if (blockedLog.length > MAX_BLOCKED_LOG) {
    blockedLog.splice(0, blockedLog.length - MAX_BLOCKED_LOG);
  }

  logger.warn("security", `BLOCKED: [${tool}] ${reason}`);
  eventBus.emit("custom:security-blocked" as any, { tool, reason, blockedBy });
}

/**
 * Get recent blocked attempts.
 */
export function getBlockedLog(limit: number = 50): typeof blockedLog {
  return blockedLog.slice(-limit);
}

// ============================================
// STATS
// ============================================

export function getSecurityStats(): {
  enabled: boolean;
  blockedTools: number;
  blockedCommands: number;
  blockedPaths: number;
  rateLimitedTools: number;
  recentBlocks: number;
  totalBlocks: number;
} {
  const cfg = loadSecurityConfig();
  const recentBlocks = blockedLog.filter((b) => Date.now() - b.timestamp < 3600_000).length;

  return {
    enabled: cfg.enabled,
    blockedTools: cfg.blockedTools.length,
    blockedCommands: cfg.blockedCommands.length,
    blockedPaths: cfg.blockedPaths.length,
    rateLimitedTools: Object.keys(cfg.rateLimits).length,
    recentBlocks,
    totalBlocks: blockedLog.length,
  };
}

// ============================================
// TOOL RISK REGISTRY (ALL 82+ tools)
// ============================================

export interface ToolRiskInfo {
  risk: RiskLevel;
  category: string;
  description: string;
  requiresConfirmation: boolean;
}

export const TOOL_RISKS: Record<string, ToolRiskInfo> = {
  // Browser (6)
  "browser-navigate":   { risk: "safe",      category: "browser",   description: "Navigate to URL",                 requiresConfirmation: false },
  "browser-act":        { risk: "moderate",   category: "browser",   description: "Perform action on webpage",       requiresConfirmation: false },
  "browser-extract":    { risk: "safe",      category: "browser",   description: "Extract data from webpage",       requiresConfirmation: false },
  "browser-screenshot": { risk: "safe",      category: "browser",   description: "Screenshot webpage",              requiresConfirmation: false },
  "web-search":         { risk: "safe",      category: "browser",   description: "Search the web",                  requiresConfirmation: false },
  "browser-agent":      { risk: "moderate",   category: "browser",   description: "Multi-step browser automation",   requiresConfirmation: false },

  // Files (11)
  "file-read":          { risk: "safe",      category: "file",      description: "Read file contents",              requiresConfirmation: false },
  "file-write":         { risk: "moderate",   category: "file",      description: "Write/create file",               requiresConfirmation: false },
  "file-list":          { risk: "safe",      category: "file",      description: "List directory contents",         requiresConfirmation: false },
  "file-move":          { risk: "moderate",   category: "file",      description: "Move/rename file",                requiresConfirmation: false },
  "file-search":        { risk: "safe",      category: "file",      description: "Search for files",                requiresConfirmation: false },
  "file-read-pdf":      { risk: "safe",      category: "file",      description: "Read PDF text",                   requiresConfirmation: false },
  "file-resize-image":  { risk: "moderate",   category: "file",      description: "Resize image",                    requiresConfirmation: false },
  "file-zip":           { risk: "moderate",   category: "file",      description: "Create ZIP archive",              requiresConfirmation: false },
  "file-unzip":         { risk: "moderate",   category: "file",      description: "Extract ZIP archive",             requiresConfirmation: false },
  "file-batch-rename":  { risk: "moderate",   category: "file",      description: "Rename multiple files",           requiresConfirmation: false },
  "file-size-info":     { risk: "safe",      category: "file",      description: "Get file/folder size",            requiresConfirmation: false },

  // Shell (1)
  "shell-execute":      { risk: "dangerous",  category: "shell",     description: "Execute shell command",           requiresConfirmation: true },

  // System (10)
  "system-info":        { risk: "safe",      category: "system",    description: "System information",              requiresConfirmation: false },
  "system-datetime":    { risk: "safe",      category: "system",    description: "Current date/time",               requiresConfirmation: false },
  "system-processes":   { risk: "safe",      category: "system",    description: "List processes",                  requiresConfirmation: false },
  "system-open-app":    { risk: "moderate",   category: "system",    description: "Open application",                requiresConfirmation: false },
  "system-kill-process":{ risk: "dangerous",  category: "system",    description: "Kill process",                    requiresConfirmation: true },
  "clipboard-read":     { risk: "safe",      category: "system",    description: "Read clipboard",                  requiresConfirmation: false },
  "clipboard-write":    { risk: "moderate",   category: "system",    description: "Write to clipboard",              requiresConfirmation: false },
  "system-notify":      { risk: "safe",      category: "system",    description: "Send notification",               requiresConfirmation: false },
  "system-screenshot":  { risk: "moderate",   category: "system",    description: "Capture screen",                  requiresConfirmation: false },
  "analyze-image":      { risk: "safe",      category: "system",    description: "Analyze image with vision",       requiresConfirmation: false },

  // Code (3)
  "code-write":         { risk: "moderate",   category: "code",      description: "Write code file",                 requiresConfirmation: false },
  "code-execute":       { risk: "dangerous",  category: "code",      description: "Execute code",                    requiresConfirmation: true },
  "code-analyze":       { risk: "safe",      category: "code",      description: "Analyze code file",               requiresConfirmation: false },

  // Data (4)
  "api-call":           { risk: "moderate",   category: "data",      description: "Make HTTP API call",              requiresConfirmation: false },
  "data-csv-parse":     { risk: "safe",      category: "data",      description: "Parse CSV data",                  requiresConfirmation: false },
  "data-json-query":    { risk: "safe",      category: "data",      description: "Query JSON data",                 requiresConfirmation: false },
  "data-transform":     { risk: "safe",      category: "data",      description: "Transform data",                  requiresConfirmation: false },

  // Memory (6)
  "memory-search":      { risk: "safe",      category: "memory",    description: "Search memory files",             requiresConfirmation: false },
  "memory-read":        { risk: "safe",      category: "memory",    description: "Read memory file",                requiresConfirmation: false },
  "memory-write":       { risk: "moderate",   category: "memory",    description: "Write memory file",               requiresConfirmation: false },
  "memory-log":         { risk: "safe",      category: "memory",    description: "Log to daily memory",             requiresConfirmation: false },
  "memory-list":        { risk: "safe",      category: "memory",    description: "List memory files",               requiresConfirmation: false },
  "memory-recall":      { risk: "safe",      category: "memory",    description: "Recall from memory",              requiresConfirmation: false },

  // Git (5)
  "git-status":         { risk: "safe",      category: "git",       description: "Git status",                      requiresConfirmation: false },
  "git-commit":         { risk: "moderate",   category: "git",       description: "Git commit",                      requiresConfirmation: false },
  "git-push":           { risk: "dangerous",  category: "git",       description: "Git push to remote",              requiresConfirmation: true },
  "git-log":            { risk: "safe",      category: "git",       description: "Git log",                         requiresConfirmation: false },
  "git-diff":           { risk: "safe",      category: "git",       description: "Git diff",                        requiresConfirmation: false },

  // Scheduler (3)
  "task-schedule":      { risk: "moderate",   category: "scheduler", description: "Schedule a task",                 requiresConfirmation: false },
  "task-list":          { risk: "safe",      category: "scheduler", description: "List scheduled tasks",            requiresConfirmation: false },
  "task-cancel":        { risk: "moderate",   category: "scheduler", description: "Cancel a task",                   requiresConfirmation: false },

  // Agent Delegation (8)
  "delegate-browser-agent":       { risk: "moderate", category: "agents", description: "Delegate to browser agent",    requiresConfirmation: false },
  "delegate-file-agent":          { risk: "moderate", category: "agents", description: "Delegate to file agent",       requiresConfirmation: false },
  "delegate-coder-agent":         { risk: "moderate", category: "agents", description: "Delegate to coder agent",      requiresConfirmation: false },
  "delegate-researcher-agent":    { risk: "moderate", category: "agents", description: "Delegate to researcher agent", requiresConfirmation: false },
  "delegate-data-analyst-agent":  { risk: "moderate", category: "agents", description: "Delegate to data analyst",    requiresConfirmation: false },
  "pass-context":       { risk: "safe",      category: "agents",    description: "Pass context between agents",     requiresConfirmation: false },
  "agent-handoff":      { risk: "moderate",   category: "agents",    description: "Hand off to another agent",       requiresConfirmation: false },
  "code-review":        { risk: "safe",      category: "agents",    description: "Review code output",              requiresConfirmation: false },

  // Planning (4)
  "create-plan":        { risk: "safe",      category: "planning",  description: "Create execution plan",           requiresConfirmation: false },
  "execute-plan-step":  { risk: "moderate",   category: "planning",  description: "Execute a plan step",             requiresConfirmation: false },
  "review-output":      { risk: "safe",      category: "planning",  description: "Review agent output",             requiresConfirmation: false },
  "get-plan-status":    { risk: "safe",      category: "planning",  description: "Get plan status",                 requiresConfirmation: false },

  // Recovery (3)
  "suggest-recovery":   { risk: "safe",      category: "recovery",  description: "Suggest error recovery",          requiresConfirmation: false },
  "log-recovery":       { risk: "safe",      category: "recovery",  description: "Log recovery attempt",            requiresConfirmation: false },
  "confidence-check":   { risk: "safe",      category: "recovery",  description: "Check confidence score",          requiresConfirmation: false },

  // Skills (4)
  "skill-list":         { risk: "safe",      category: "skills",    description: "List available skills/plugins",   requiresConfirmation: false },
  "skill-match":        { risk: "safe",      category: "skills",    description: "Find matching skills",            requiresConfirmation: false },
  "skill-load":         { risk: "safe",      category: "skills",    description: "Load skill instructions",         requiresConfirmation: false },
  "skill-create":       { risk: "moderate",   category: "skills",    description: "Create a new skill",              requiresConfirmation: false },

  // Workflows (7)
  "workflow-list":      { risk: "safe",      category: "workflows", description: "List workflow templates",         requiresConfirmation: false },
  "workflow-run":       { risk: "moderate",   category: "workflows", description: "Execute a workflow",              requiresConfirmation: false },
  "workflow-status":    { risk: "safe",      category: "workflows", description: "Get workflow run status",         requiresConfirmation: false },
  "workflow-history":   { risk: "safe",      category: "workflows", description: "List workflow run history",       requiresConfirmation: false },
  "workflow-resume":    { risk: "moderate",   category: "workflows", description: "Resume suspended workflow",       requiresConfirmation: false },
  "workflow-cancel":    { risk: "moderate",   category: "workflows", description: "Cancel running workflow",         requiresConfirmation: false },
  "workflow-stats":     { risk: "safe",      category: "workflows", description: "Workflow execution stats",        requiresConfirmation: false },

  // Triggers (4)
  "trigger-create":     { risk: "moderate",   category: "triggers",  description: "Create automation trigger",       requiresConfirmation: false },
  "trigger-list":       { risk: "safe",      category: "triggers",  description: "List all triggers",               requiresConfirmation: false },
  "trigger-delete":     { risk: "moderate",   category: "triggers",  description: "Delete a trigger",                requiresConfirmation: false },
  "trigger-toggle":     { risk: "safe",      category: "triggers",  description: "Enable/disable trigger",          requiresConfirmation: false },

  // Plugins (5)
  "plugin-list":        { risk: "safe",      category: "plugins",   description: "List installed plugins",          requiresConfirmation: false },
  "plugin-create":      { risk: "moderate",   category: "plugins",   description: "Create new plugin scaffold",      requiresConfirmation: false },
  "plugin-install":     { risk: "moderate",   category: "plugins",   description: "Install plugin from path",        requiresConfirmation: false },
  "plugin-toggle":      { risk: "safe",      category: "plugins",   description: "Enable/disable plugin",           requiresConfirmation: false },
  "plugin-uninstall":   { risk: "dangerous",  category: "plugins",   description: "Remove plugin from disk",         requiresConfirmation: true },
};

/** Get risk info for a tool */
export function getToolRiskInfo(toolId: string): ToolRiskInfo | null {
  return TOOL_RISKS[toolId] || null;
}

/** Get risk level for a tool (default: moderate) */
export function getRiskLevel(toolId: string): RiskLevel {
  return TOOL_RISKS[toolId]?.risk || "moderate";
}

/** Check if tool requires confirmation */
export function requiresConfirmation(toolId: string): boolean {
  return TOOL_RISKS[toolId]?.requiresConfirmation || false;
}

/** Get tools by risk level */
export function getToolsByRiskLevel(risk: RiskLevel): string[] {
  return Object.entries(TOOL_RISKS).filter(([, info]) => info.risk === risk).map(([id]) => id);
}

/** Get dangerous tools */
export function getDangerousTools(): string[] {
  return Object.entries(TOOL_RISKS).filter(([, info]) => info.requiresConfirmation).map(([id]) => id);
}

/** Risk level display info */
export const RISK_LEVELS = {
  safe:      { label: "Safe",      emoji: "🟢", color: "#22c55e", bgColor: "#dcfce7", description: "Read-only, no system changes" },
  moderate:  { label: "Moderate",  emoji: "🟡", color: "#eab308", bgColor: "#fef9c3", description: "Write operations, can be undone" },
  dangerous: { label: "Dangerous", emoji: "🔴", color: "#ef4444", bgColor: "#fee2e2", description: "Destructive, requires confirmation" },
};

export function getRiskDisplay(risk: RiskLevel) {
  return RISK_LEVELS[risk];
}

/** Permission stats */
export function getPermissionStats() {
  const tools = Object.values(TOOL_RISKS);
  return {
    total: tools.length,
    safe: tools.filter((t) => t.risk === "safe").length,
    moderate: tools.filter((t) => t.risk === "moderate").length,
    dangerous: tools.filter((t) => t.risk === "dangerous").length,
    requiresConfirmation: tools.filter((t) => t.requiresConfirmation).length,
    categories: [...new Set(tools.map((t) => t.category))],
  };
}
