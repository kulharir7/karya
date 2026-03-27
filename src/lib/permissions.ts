/**
 * Karya Permission System — Tool risk levels & confirmations
 * 
 * Risk Levels:
 * - safe: Read-only, no side effects
 * - moderate: Write operations, reversible
 * - dangerous: Destructive, irreversible, system-level
 * 
 * Dangerous tools require user confirmation before execution.
 */

import { eventBus } from "./event-bus";

// Risk levels
export type RiskLevel = "safe" | "moderate" | "dangerous";

// Tool permission config
export interface ToolPermission {
  tool: string;
  risk: RiskLevel;
  requiresConfirmation: boolean;
  description: string;
}

// Permission check result
export interface PermissionResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  risk: RiskLevel;
  reason?: string;
}

// Tool risk definitions
const TOOL_RISKS: Record<string, { risk: RiskLevel; desc: string }> = {
  // Safe tools (read-only)
  "system-info": { risk: "safe", desc: "Read system information" },
  "system-datetime": { risk: "safe", desc: "Get current date/time" },
  "system-processes": { risk: "safe", desc: "List running processes" },
  "clipboard-read": { risk: "safe", desc: "Read clipboard content" },
  "file-read": { risk: "safe", desc: "Read file contents" },
  "file-list": { risk: "safe", desc: "List directory contents" },
  "file-search": { risk: "safe", desc: "Search for files" },
  "file-size-info": { risk: "safe", desc: "Get file/folder size" },
  "file-read-pdf": { risk: "safe", desc: "Read PDF content" },
  "web-search": { risk: "safe", desc: "Search the web" },
  "memory-search": { risk: "safe", desc: "Search memory files" },
  "memory-read": { risk: "safe", desc: "Read memory file" },
  "memory-list": { risk: "safe", desc: "List memory files" },
  "git-status": { risk: "safe", desc: "Check git status" },
  "git-log": { risk: "safe", desc: "View git history" },
  "git-diff": { risk: "safe", desc: "View git changes" },
  "task-list": { risk: "safe", desc: "List scheduled tasks" },
  "skill-list": { risk: "safe", desc: "List available skills" },
  "skill-match": { risk: "safe", desc: "Find matching skills" },
  "skill-load": { risk: "safe", desc: "Load skill instructions" },
  "workflow-list": { risk: "safe", desc: "List workflows" },
  "workflow-status": { risk: "safe", desc: "Check workflow status" },
  "workflow-history": { risk: "safe", desc: "View workflow history" },
  "workflow-stats": { risk: "safe", desc: "Workflow statistics" },
  "analyze-image": { risk: "safe", desc: "Analyze image content" },
  "data-json-query": { risk: "safe", desc: "Query JSON data" },
  "data-csv-parse": { risk: "safe", desc: "Parse CSV data" },
  "code-analyze": { risk: "safe", desc: "Analyze code structure" },
  
  // Moderate tools (write, but reversible)
  "file-write": { risk: "moderate", desc: "Write to files" },
  "file-move": { risk: "moderate", desc: "Move/rename files" },
  "file-zip": { risk: "moderate", desc: "Create archives" },
  "file-unzip": { risk: "moderate", desc: "Extract archives" },
  "file-batch-rename": { risk: "moderate", desc: "Rename multiple files" },
  "file-resize-image": { risk: "moderate", desc: "Resize images" },
  "clipboard-write": { risk: "moderate", desc: "Write to clipboard" },
  "memory-write": { risk: "moderate", desc: "Update memory files" },
  "memory-log": { risk: "moderate", desc: "Log to daily file" },
  "system-notify": { risk: "moderate", desc: "Show notification" },
  "system-open-app": { risk: "moderate", desc: "Open application" },
  "code-write": { risk: "moderate", desc: "Write code files" },
  "api-call": { risk: "moderate", desc: "Make HTTP requests" },
  "data-transform": { risk: "moderate", desc: "Transform data" },
  "git-commit": { risk: "moderate", desc: "Commit changes" },
  "task-schedule": { risk: "moderate", desc: "Schedule task" },
  "task-cancel": { risk: "moderate", desc: "Cancel task" },
  "skill-create": { risk: "moderate", desc: "Create new skill" },
  "workflow-run": { risk: "moderate", desc: "Run workflow" },
  "workflow-resume": { risk: "moderate", desc: "Resume workflow" },
  "workflow-cancel": { risk: "moderate", desc: "Cancel workflow" },
  "browser-navigate": { risk: "moderate", desc: "Open webpage" },
  "browser-act": { risk: "moderate", desc: "Interact with page" },
  "browser-extract": { risk: "moderate", desc: "Extract page data" },
  "browser-screenshot": { risk: "moderate", desc: "Capture webpage" },
  "system-screenshot": { risk: "moderate", desc: "Capture screen" },
  
  // Dangerous tools (destructive, system-level)
  "shell-execute": { risk: "dangerous", desc: "Execute shell commands" },
  "code-execute": { risk: "dangerous", desc: "Execute code" },
  "system-kill-process": { risk: "dangerous", desc: "Kill processes" },
  "git-push": { risk: "dangerous", desc: "Push to remote" },
  "browser-agent": { risk: "dangerous", desc: "Autonomous browsing" },
  "delegate-browser-agent": { risk: "dangerous", desc: "Delegate to browser agent" },
  "delegate-coder-agent": { risk: "dangerous", desc: "Delegate to coder agent" },
};

// Blocked tools (never execute)
const BLOCKED_TOOLS: string[] = [
  // Add any tools that should be completely blocked
];

// Pending confirmations
const pendingConfirmations: Map<string, {
  tool: string;
  args: any;
  resolve: (confirmed: boolean) => void;
  timestamp: number;
}> = new Map();

/**
 * Get risk level for a tool
 */
export function getToolRisk(tool: string): RiskLevel {
  return TOOL_RISKS[tool]?.risk || "moderate";
}

/**
 * Get tool permission details
 */
export function getToolPermission(tool: string): ToolPermission {
  const info = TOOL_RISKS[tool] || { risk: "moderate", desc: "Unknown tool" };
  return {
    tool,
    risk: info.risk,
    requiresConfirmation: info.risk === "dangerous",
    description: info.desc,
  };
}

/**
 * Check if tool execution is allowed
 */
export function checkPermission(tool: string): PermissionResult {
  // Blocked tools
  if (BLOCKED_TOOLS.includes(tool)) {
    return {
      allowed: false,
      requiresConfirmation: false,
      risk: "dangerous",
      reason: "This tool is blocked",
    };
  }
  
  const risk = getToolRisk(tool);
  
  return {
    allowed: true,
    requiresConfirmation: risk === "dangerous",
    risk,
  };
}

/**
 * Request confirmation for dangerous tool
 */
export function requestConfirmation(
  tool: string,
  args: any
): Promise<boolean> {
  const confirmId = `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  
  return new Promise((resolve) => {
    pendingConfirmations.set(confirmId, {
      tool,
      args,
      resolve,
      timestamp: Date.now(),
    });
    
    // Emit confirmation request event
    eventBus.emit("permission:confirmation_required" as any, {
      confirmId,
      tool,
      args,
      risk: getToolRisk(tool),
    });
    
    // Auto-deny after 60 seconds
    setTimeout(() => {
      if (pendingConfirmations.has(confirmId)) {
        pendingConfirmations.delete(confirmId);
        resolve(false);
      }
    }, 60000);
  });
}

/**
 * Respond to confirmation request
 */
export function confirmPermission(confirmId: string, confirmed: boolean): boolean {
  const pending = pendingConfirmations.get(confirmId);
  if (!pending) return false;
  
  pending.resolve(confirmed);
  pendingConfirmations.delete(confirmId);
  
  eventBus.emit("permission:confirmed" as any, {
    confirmId,
    tool: pending.tool,
    confirmed,
  });
  
  return true;
}

/**
 * Get pending confirmations
 */
export function getPendingConfirmations(): Array<{
  confirmId: string;
  tool: string;
  args: any;
  timestamp: number;
}> {
  return Array.from(pendingConfirmations.entries()).map(([id, data]) => ({
    confirmId: id,
    tool: data.tool,
    args: data.args,
    timestamp: data.timestamp,
  }));
}

/**
 * Get all tool permissions
 */
export function getAllPermissions(): ToolPermission[] {
  return Object.entries(TOOL_RISKS).map(([tool, info]) => ({
    tool,
    risk: info.risk,
    requiresConfirmation: info.risk === "dangerous",
    description: info.desc,
  }));
}

/**
 * Get tools by risk level
 */
export function getToolsByRisk(risk: RiskLevel): string[] {
  return Object.entries(TOOL_RISKS)
    .filter(([, info]) => info.risk === risk)
    .map(([tool]) => tool);
}

/**
 * Permission stats
 */
export function getPermissionStats(): {
  total: number;
  safe: number;
  moderate: number;
  dangerous: number;
  blocked: number;
} {
  const tools = Object.values(TOOL_RISKS);
  return {
    total: tools.length,
    safe: tools.filter(t => t.risk === "safe").length,
    moderate: tools.filter(t => t.risk === "moderate").length,
    dangerous: tools.filter(t => t.risk === "dangerous").length,
    blocked: BLOCKED_TOOLS.length,
  };
}
