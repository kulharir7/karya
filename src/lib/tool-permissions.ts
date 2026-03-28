/**
 * Tool Permissions — Risk registry for UI and API consumption
 * 
 * Phase 8.5: This file contains ONLY pure data (no fs, no path, no Node.js modules).
 * Safe to import from client components (ToolCard.tsx) AND server code.
 * 
 * The enforcement logic lives in security-engine.ts (server-only).
 * This file just has the risk data + display helpers.
 */

// ============================================
// TYPES
// ============================================

export type RiskLevel = "safe" | "moderate" | "dangerous";

export interface ToolRiskInfo {
  risk: RiskLevel;
  category: string;
  description: string;
  requiresConfirmation: boolean;
}

// ============================================
// TOOL RISK REGISTRY — ALL 82 TOOLS
// ============================================

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
  "delegate-browser-agent":      { risk: "moderate", category: "agents", description: "Delegate to browser agent",    requiresConfirmation: false },
  "delegate-file-agent":         { risk: "moderate", category: "agents", description: "Delegate to file agent",       requiresConfirmation: false },
  "delegate-coder-agent":        { risk: "moderate", category: "agents", description: "Delegate to coder agent",      requiresConfirmation: false },
  "delegate-researcher-agent":   { risk: "moderate", category: "agents", description: "Delegate to researcher agent", requiresConfirmation: false },
  "delegate-data-analyst-agent": { risk: "moderate", category: "agents", description: "Delegate to data analyst",    requiresConfirmation: false },
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

// ============================================
// QUERY FUNCTIONS (pure, no Node.js deps)
// ============================================

export function getRiskLevel(toolId: string): RiskLevel {
  return TOOL_RISKS[toolId]?.risk || "moderate";
}

export function getToolRiskInfo(toolId: string): ToolRiskInfo | null {
  return TOOL_RISKS[toolId] || null;
}

export function requiresConfirmation(toolId: string): boolean {
  return TOOL_RISKS[toolId]?.requiresConfirmation || false;
}

export function getToolsByRisk(risk: RiskLevel): string[] {
  return Object.entries(TOOL_RISKS).filter(([, info]) => info.risk === risk).map(([id]) => id);
}

export function getDangerousTools(): string[] {
  return Object.entries(TOOL_RISKS).filter(([, info]) => info.requiresConfirmation).map(([id]) => id);
}

export const RISK_LEVELS = {
  safe:      { label: "Safe",      emoji: "🟢", color: "#22c55e", bgColor: "#dcfce7", description: "Read-only, no system changes" },
  moderate:  { label: "Moderate",  emoji: "🟡", color: "#eab308", bgColor: "#fef9c3", description: "Write operations, can be undone" },
  dangerous: { label: "Dangerous", emoji: "🔴", color: "#ef4444", bgColor: "#fee2e2", description: "Destructive, requires confirmation" },
};

export function getRiskDisplay(risk: RiskLevel) {
  return RISK_LEVELS[risk];
}

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
