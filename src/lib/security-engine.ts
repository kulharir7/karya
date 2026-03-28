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
import { getRiskLevel as getToolRisk, requiresConfirmation as toolRequiresConfirm } from "./tool-permissions";

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
// RE-EXPORTS from tool-permissions (for backward compat)
// Tool risk data lives in tool-permissions.ts (client-safe, no fs)
// ============================================

export type { RiskLevel as SecurityRiskLevel, ToolRiskInfo } from "./tool-permissions";
export {
  TOOL_RISKS,
  RISK_LEVELS,
  getToolRiskInfo,
  getToolsByRisk as getToolsByRiskLevel,
  getDangerousTools,
  getRiskDisplay,
  getPermissionStats,
} from "./tool-permissions";

// NOTE: getRiskLevel and requiresConfirmation are imported at top as
// getToolRisk and toolRequiresConfirm to avoid name conflicts with
// this file's own RiskLevel type. Re-export with original names:
export { getRiskLevel, requiresConfirmation } from "./tool-permissions";
