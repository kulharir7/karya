/**
 * System Prompt Builder — OpenClaw-style
 * 
 * Builds structured system prompt with:
 * 1. Base instructions
 * 2. Tooling section
 * 3. Skills list
 * 4. Workspace info
 * 5. Project Context (bootstrap files)
 * 6. Runtime info
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getCurrentModelId, getCurrentProvider } from "./llm";

// Workspace path
const WORKSPACE_DIR = path.join(process.cwd(), "workspace");

// Bootstrap files to inject (order matters)
const BOOTSTRAP_FILES = [
  "AGENTS.md",
  "SOUL.md", 
  "USER.md",
  "MEMORY.md",  // Long-term memory
  "TOOLS.md",
  "IDENTITY.md",
  "HEARTBEAT.md",
];

// Max chars per file (truncate if larger)
const MAX_CHARS_PER_FILE = 15000;

/**
 * Load a workspace file safely
 */
function loadWorkspaceFile(filename: string): { content: string; exists: boolean; truncated: boolean } {
  const filepath = path.join(WORKSPACE_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    return { content: "", exists: false, truncated: false };
  }
  
  try {
    let content = fs.readFileSync(filepath, "utf-8");
    let truncated = false;
    
    if (content.length > MAX_CHARS_PER_FILE) {
      content = content.slice(0, MAX_CHARS_PER_FILE) + "\n\n[... truncated, read file for full content ...]";
      truncated = true;
    }
    
    return { content: content.trim(), exists: true, truncated };
  } catch {
    return { content: "", exists: false, truncated: false };
  }
}

/**
 * Get current date/time info
 */
function getDateTimeInfo(): string {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${now.toLocaleString("en-IN", { 
    weekday: "long", 
    year: "numeric", 
    month: "long", 
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone 
  })} (${timezone})`;
}

/**
 * Get runtime info
 */
function getRuntimeInfo(): string {
  const model = getCurrentModelId();
  const provider = getCurrentProvider();
  
  return [
    `Host: ${os.hostname()}`,
    `OS: ${os.type()} ${os.release()} (${os.arch()})`,
    `Provider: ${provider}`,
    `Model: ${model}`,
    `Workspace: ${WORKSPACE_DIR}`,
    `Node: ${process.version}`,
  ].join(" | ");
}

/**
 * Get today's daily log filename
 */
function getTodayLogFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `memory/${year}-${month}-${day}.md`;
}

/**
 * Build the Project Context section with bootstrap files
 */
function buildProjectContext(): string {
  const sections: string[] = [];
  
  sections.push("## Project Context");
  sections.push("The following workspace files are loaded for context:\n");
  
  // Load bootstrap files
  for (const filename of BOOTSTRAP_FILES) {
    const { content, exists, truncated } = loadWorkspaceFile(filename);
    
    if (!exists) {
      // Skip missing files silently
      continue;
    }
    
    if (!content) {
      continue;
    }
    
    sections.push(`### ${WORKSPACE_DIR}/${filename}`);
    if (truncated) {
      sections.push("*[File truncated for context window]*\n");
    }
    sections.push(content);
    sections.push(""); // Empty line between files
  }
  
  // Also load today's daily log (recent context)
  const todayLog = getTodayLogFilename();
  const { content: todayContent, exists: todayExists } = loadWorkspaceFile(todayLog);
  if (todayExists && todayContent) {
    sections.push(`### ${WORKSPACE_DIR}/${todayLog} (Today's Log)`);
    // Only last 5000 chars of today's log to save tokens
    const truncatedToday = todayContent.length > 5000 
      ? "...\n" + todayContent.slice(-5000) 
      : todayContent;
    sections.push(truncatedToday);
    sections.push("");
  }
  
  return sections.join("\n");
}

/**
 * Build the complete system prompt
 */
export function buildSystemPrompt(baseInstructions: string): string {
  const sections: string[] = [];
  
  // 1. Base instructions (from agent config)
  sections.push(baseInstructions);
  
  // 2. Workspace section
  sections.push(`
## Workspace
Your working directory is: ${WORKSPACE_DIR}
All file operations use this as the base directory.
Use workspace/ for user files, memory/ for logs.
`);

  // 3. Current Date & Time
  sections.push(`
## Current Date & Time
${getDateTimeInfo()}
`);

  // 4. Project Context (bootstrap files)
  const projectContext = buildProjectContext();
  if (projectContext.includes("###")) { // Has at least one file
    sections.push(projectContext);
  }

  // 5. Runtime info (compact, at end)
  sections.push(`
## Runtime
${getRuntimeInfo()}
`);

  // 6. Silent reply instruction
  sections.push(`
## Silent Replies
When you have nothing meaningful to say, reply with ONLY: NO_REPLY
This must be your ENTIRE message — nothing else.
`);

  return sections.join("\n");
}

/**
 * Ensure workspace exists with default files
 */
export function ensureWorkspace(): void {
  // Create workspace dir
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
  
  // Create memory dir
  const memoryDir = path.join(WORKSPACE_DIR, "memory");
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }
  
  // Create default AGENTS.md if missing
  const agentsPath = path.join(WORKSPACE_DIR, "AGENTS.md");
  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(agentsPath, `# AGENTS.md - Operating Instructions

## Your Role
You are Karya, an autonomous AI computer agent. Your job is to COMPLETE tasks, not ask questions.

## Memory
- Daily logs: memory/YYYY-MM-DD.md
- Long-term: MEMORY.md (create if needed)
- After completing tasks, log what you did

## Rules
1. Use tools to get real data — never make up information
2. If a tool fails, try alternatives
3. Complete tasks fully before responding
4. Reply in user's language (Hindi→Hindi, English→English)

## Safety
- For destructive actions (delete, format), confirm first
- For creative/constructive actions, just do it
`, "utf-8");
  }
  
  // Create default SOUL.md if missing
  const soulPath = path.join(WORKSPACE_DIR, "SOUL.md");
  if (!fs.existsSync(soulPath)) {
    fs.writeFileSync(soulPath, `# SOUL.md - Who You Are

You are Karya — a capable, autonomous AI agent.

## Personality
- Helpful and competent
- Direct, not verbose
- Action-oriented — do things, don't just talk about them

## Communication
- Match the user's language
- Be concise but complete
- Show what you did, not what you can do
`, "utf-8");
  }
  
  // Create default USER.md if missing
  const userPath = path.join(WORKSPACE_DIR, "USER.md");
  if (!fs.existsSync(userPath)) {
    fs.writeFileSync(userPath, `# USER.md - About the User

- **Name**: (learn from conversation)
- **Timezone**: Asia/Kolkata
- **Language**: Hindi/English

## Preferences
(Learn and add preferences as you interact)
`, "utf-8");
  }
  
  // Create default MEMORY.md if missing
  const memoryPath = path.join(WORKSPACE_DIR, "MEMORY.md");
  if (!fs.existsSync(memoryPath)) {
    fs.writeFileSync(memoryPath, `# MEMORY.md - Long Term Memory

This file stores important facts, decisions, and learnings that should persist across sessions.

## User Info
(Add user details as you learn them)

## Projects
(Track ongoing projects)

## Preferences
(Remember user preferences)

## Decisions Made
(Important decisions that affect future interactions)

---
*Last updated: (auto-update when you learn something new)*
`, "utf-8");
  }
}

/**
 * Get workspace path for external use
 */
export function getWorkspacePath(): string {
  return WORKSPACE_DIR;
}
