/**
 * Tool Permission System - Risk Levels
 * 
 * Every tool is assigned a risk level:
 * - safe (🟢): Read-only operations, no system changes
 * - moderate (🟡): Write operations that can be undone
 * - dangerous (🔴): Destructive operations, requires confirmation
 */

export type RiskLevel = 'safe' | 'moderate' | 'dangerous';

export interface ToolRiskInfo {
  risk: RiskLevel;
  category: string;
  description: string;
  requiresConfirmation: boolean;
}

/**
 * Tool Risk Registry
 * Maps tool IDs to their risk information
 */
export const TOOL_RISKS: Record<string, ToolRiskInfo> = {
  // ============================================
  // BROWSER TOOLS
  // ============================================
  'navigate': {
    risk: 'safe',
    category: 'browser',
    description: 'Navigate to a URL',
    requiresConfirmation: false,
  },
  'act': {
    risk: 'moderate',
    category: 'browser',
    description: 'Perform action on webpage (click, type, etc)',
    requiresConfirmation: false,
  },
  'extract': {
    risk: 'safe',
    category: 'browser',
    description: 'Extract data from webpage',
    requiresConfirmation: false,
  },
  'screenshot': {
    risk: 'safe',
    category: 'browser',
    description: 'Take screenshot of webpage',
    requiresConfirmation: false,
  },
  'web-search': {
    risk: 'safe',
    category: 'browser',
    description: 'Search the web',
    requiresConfirmation: false,
  },
  'browser-agent': {
    risk: 'moderate',
    category: 'browser',
    description: 'Multi-step browser automation',
    requiresConfirmation: false,
  },

  // ============================================
  // FILE TOOLS
  // ============================================
  'read-file': {
    risk: 'safe',
    category: 'file',
    description: 'Read file contents',
    requiresConfirmation: false,
  },
  'write-file': {
    risk: 'moderate',
    category: 'file',
    description: 'Write/create file',
    requiresConfirmation: false,
  },
  'list-files': {
    risk: 'safe',
    category: 'file',
    description: 'List files in directory',
    requiresConfirmation: false,
  },
  'move-file': {
    risk: 'moderate',
    category: 'file',
    description: 'Move or rename file',
    requiresConfirmation: false,
  },
  'delete-file': {
    risk: 'dangerous',
    category: 'file',
    description: 'Delete file permanently',
    requiresConfirmation: true,
  },
  'search-files': {
    risk: 'safe',
    category: 'file',
    description: 'Search for files',
    requiresConfirmation: false,
  },
  'read-pdf': {
    risk: 'safe',
    category: 'file',
    description: 'Extract text from PDF',
    requiresConfirmation: false,
  },
  'resize-image': {
    risk: 'moderate',
    category: 'file',
    description: 'Resize image file',
    requiresConfirmation: false,
  },
  'zip': {
    risk: 'moderate',
    category: 'file',
    description: 'Create ZIP archive',
    requiresConfirmation: false,
  },
  'unzip': {
    risk: 'moderate',
    category: 'file',
    description: 'Extract ZIP archive',
    requiresConfirmation: false,
  },
  'batch-rename': {
    risk: 'moderate',
    category: 'file',
    description: 'Rename multiple files',
    requiresConfirmation: false,
  },
  'size-info': {
    risk: 'safe',
    category: 'file',
    description: 'Get file/folder size',
    requiresConfirmation: false,
  },

  // ============================================
  // SHELL TOOLS
  // ============================================
  'execute-command': {
    risk: 'dangerous',
    category: 'shell',
    description: 'Execute shell command',
    requiresConfirmation: true,
  },
  'shell-execute': {
    risk: 'dangerous',
    category: 'shell',
    description: 'Execute shell command',
    requiresConfirmation: true,
  },

  // ============================================
  // SYSTEM TOOLS
  // ============================================
  'system-info': {
    risk: 'safe',
    category: 'system',
    description: 'Get system information',
    requiresConfirmation: false,
  },
  'system-datetime': {
    risk: 'safe',
    category: 'system',
    description: 'Get current date/time',
    requiresConfirmation: false,
  },
  'list-processes': {
    risk: 'safe',
    category: 'system',
    description: 'List running processes',
    requiresConfirmation: false,
  },
  'open-app': {
    risk: 'moderate',
    category: 'system',
    description: 'Open application',
    requiresConfirmation: false,
  },
  'kill-process': {
    risk: 'dangerous',
    category: 'system',
    description: 'Terminate a process',
    requiresConfirmation: true,
  },
  'clipboard-read': {
    risk: 'safe',
    category: 'system',
    description: 'Read clipboard contents',
    requiresConfirmation: false,
  },
  'clipboard-write': {
    risk: 'moderate',
    category: 'system',
    description: 'Write to clipboard',
    requiresConfirmation: false,
  },
  'notify': {
    risk: 'safe',
    category: 'system',
    description: 'Show notification',
    requiresConfirmation: false,
  },
  'system-screenshot': {
    risk: 'moderate',
    category: 'system',
    description: 'Capture screen for analysis',
    requiresConfirmation: false,
  },
  'analyze-image': {
    risk: 'safe',
    category: 'system',
    description: 'Analyze image using vision AI',
    requiresConfirmation: false,
  },

  // ============================================
  // CODE TOOLS
  // ============================================
  'code-write': {
    risk: 'moderate',
    category: 'code',
    description: 'Write code to file',
    requiresConfirmation: false,
  },
  'code-execute': {
    risk: 'dangerous',
    category: 'code',
    description: 'Execute code directly',
    requiresConfirmation: true,
  },
  'code-lint': {
    risk: 'safe',
    category: 'code',
    description: 'Lint/analyze code',
    requiresConfirmation: false,
  },
  'code-review': {
    risk: 'safe',
    category: 'code',
    description: 'Review code for issues',
    requiresConfirmation: false,
  },

  // ============================================
  // DATA TOOLS
  // ============================================
  'data-parse-csv': {
    risk: 'safe',
    category: 'data',
    description: 'Parse CSV file',
    requiresConfirmation: false,
  },
  'data-parse-json': {
    risk: 'safe',
    category: 'data',
    description: 'Parse JSON file',
    requiresConfirmation: false,
  },
  'data-analyze': {
    risk: 'safe',
    category: 'data',
    description: 'Analyze data statistics',
    requiresConfirmation: false,
  },
  'data-transform': {
    risk: 'moderate',
    category: 'data',
    description: 'Transform data and save',
    requiresConfirmation: false,
  },

  // ============================================
  // MEMORY TOOLS
  // ============================================
  'memory-search': {
    risk: 'safe',
    category: 'memory',
    description: 'Search memory files',
    requiresConfirmation: false,
  },
  'memory-read': {
    risk: 'safe',
    category: 'memory',
    description: 'Read memory file',
    requiresConfirmation: false,
  },
  'memory-write': {
    risk: 'moderate',
    category: 'memory',
    description: 'Write to memory file',
    requiresConfirmation: false,
  },
  'memory-log': {
    risk: 'safe',
    category: 'memory',
    description: 'Append to daily log',
    requiresConfirmation: false,
  },
  'memory-list': {
    risk: 'safe',
    category: 'memory',
    description: 'List memory files',
    requiresConfirmation: false,
  },

  // ============================================
  // GIT TOOLS
  // ============================================
  'git-status': {
    risk: 'safe',
    category: 'git',
    description: 'Check git status',
    requiresConfirmation: false,
  },
  'git-commit': {
    risk: 'moderate',
    category: 'git',
    description: 'Commit changes',
    requiresConfirmation: false,
  },
  'git-push': {
    risk: 'moderate',
    category: 'git',
    description: 'Push to remote',
    requiresConfirmation: false,
  },
  'git-log': {
    risk: 'safe',
    category: 'git',
    description: 'View commit history',
    requiresConfirmation: false,
  },
  'git-diff': {
    risk: 'safe',
    category: 'git',
    description: 'View file changes',
    requiresConfirmation: false,
  },

  // ============================================
  // PLANNING TOOLS
  // ============================================
  'create-plan': {
    risk: 'safe',
    category: 'planning',
    description: 'Create execution plan',
    requiresConfirmation: false,
  },
  'execute-plan-step': {
    risk: 'moderate',
    category: 'planning',
    description: 'Execute a plan step',
    requiresConfirmation: false,
  },
  'get-plan-status': {
    risk: 'safe',
    category: 'planning',
    description: 'Get plan status',
    requiresConfirmation: false,
  },

  // ============================================
  // RECOVERY TOOLS
  // ============================================
  'suggest-recovery': {
    risk: 'safe',
    category: 'recovery',
    description: 'Suggest error recovery',
    requiresConfirmation: false,
  },
  'log-recovery': {
    risk: 'safe',
    category: 'recovery',
    description: 'Log recovery attempt',
    requiresConfirmation: false,
  },

  // ============================================
  // CONFIDENCE TOOLS
  // ============================================
  'confidence-check': {
    risk: 'safe',
    category: 'confidence',
    description: 'Check confidence score',
    requiresConfirmation: false,
  },

  // ============================================
  // SCHEDULER TOOLS
  // ============================================
  'task-schedule': {
    risk: 'moderate',
    category: 'scheduler',
    description: 'Schedule a task',
    requiresConfirmation: false,
  },
  'task-list': {
    risk: 'safe',
    category: 'scheduler',
    description: 'List scheduled tasks',
    requiresConfirmation: false,
  },
  'task-cancel': {
    risk: 'moderate',
    category: 'scheduler',
    description: 'Cancel a task',
    requiresConfirmation: false,
  },

  // ============================================
  // AGENT DELEGATION TOOLS
  // ============================================
  'delegate-browser-agent': {
    risk: 'moderate',
    category: 'agents',
    description: 'Delegate to browser agent',
    requiresConfirmation: false,
  },
  'delegate-file-agent': {
    risk: 'moderate',
    category: 'agents',
    description: 'Delegate to file agent',
    requiresConfirmation: false,
  },
  'delegate-coder-agent': {
    risk: 'moderate',
    category: 'agents',
    description: 'Delegate to coder agent',
    requiresConfirmation: false,
  },
  'delegate-researcher-agent': {
    risk: 'moderate',
    category: 'agents',
    description: 'Delegate to researcher agent',
    requiresConfirmation: false,
  },
  'delegate-data-analyst-agent': {
    risk: 'moderate',
    category: 'agents',
    description: 'Delegate to data analyst agent',
    requiresConfirmation: false,
  },

  // ============================================
  // AGENT COMMUNICATION TOOLS
  // ============================================
  'pass-context': {
    risk: 'safe',
    category: 'agents',
    description: 'Pass context between agents',
    requiresConfirmation: false,
  },
  'agent-handoff': {
    risk: 'moderate',
    category: 'agents',
    description: 'Handoff to another agent',
    requiresConfirmation: false,
  },
  // ============================================
  // SKILL TOOLS
  // ============================================
  'skill-list': {
    risk: 'safe',
    category: 'skills',
    description: 'List all available skills',
    requiresConfirmation: false,
  },
  'skill-match': {
    risk: 'safe',
    category: 'skills',
    description: 'Find skills matching a query',
    requiresConfirmation: false,
  },
  'skill-load': {
    risk: 'safe',
    category: 'skills',
    description: 'Load skill instructions',
    requiresConfirmation: false,
  },
  'skill-create': {
    risk: 'moderate',
    category: 'skills',
    description: 'Create a new skill',
    requiresConfirmation: false,
  },
};

/**
 * Get risk level for a tool
 */
export function getRiskLevel(toolId: string): RiskLevel {
  const info = TOOL_RISKS[toolId];
  return info?.risk ?? 'moderate'; // Default to moderate if unknown
}

/**
 * Get full risk info for a tool
 */
export function getToolRiskInfo(toolId: string): ToolRiskInfo | null {
  return TOOL_RISKS[toolId] ?? null;
}

/**
 * Check if tool requires confirmation
 */
export function requiresConfirmation(toolId: string): boolean {
  const info = TOOL_RISKS[toolId];
  return info?.requiresConfirmation ?? false;
}

/**
 * Get all tools by risk level
 */
export function getToolsByRisk(risk: RiskLevel): string[] {
  return Object.entries(TOOL_RISKS)
    .filter(([_, info]) => info.risk === risk)
    .map(([toolId]) => toolId);
}

/**
 * Get all tools by category
 */
export function getToolsByCategory(category: string): string[] {
  return Object.entries(TOOL_RISKS)
    .filter(([_, info]) => info.category === category)
    .map(([toolId]) => toolId);
}

/**
 * Get dangerous tools (requires confirmation)
 */
export function getDangerousTools(): string[] {
  return Object.entries(TOOL_RISKS)
    .filter(([_, info]) => info.requiresConfirmation)
    .map(([toolId]) => toolId);
}

/**
 * Risk level metadata
 */
export const RISK_LEVELS = {
  safe: {
    label: 'Safe',
    emoji: '🟢',
    color: '#22c55e', // green-500
    bgColor: '#dcfce7', // green-100
    description: 'Read-only, no system changes',
  },
  moderate: {
    label: 'Moderate',
    emoji: '🟡',
    color: '#eab308', // yellow-500
    bgColor: '#fef9c3', // yellow-100
    description: 'Write operations, can be undone',
  },
  dangerous: {
    label: 'Dangerous',
    emoji: '🔴',
    color: '#ef4444', // red-500
    bgColor: '#fee2e2', // red-100
    description: 'Destructive, requires confirmation',
  },
};

/**
 * Get risk level display info
 */
export function getRiskDisplay(risk: RiskLevel) {
  return RISK_LEVELS[risk];
}

/**
 * Summary stats
 */
export function getPermissionStats() {
  const tools = Object.values(TOOL_RISKS);
  return {
    total: tools.length,
    safe: tools.filter(t => t.risk === 'safe').length,
    moderate: tools.filter(t => t.risk === 'moderate').length,
    dangerous: tools.filter(t => t.risk === 'dangerous').length,
    requiresConfirmation: tools.filter(t => t.requiresConfirmation).length,
    categories: [...new Set(tools.map(t => t.category))],
  };
}
