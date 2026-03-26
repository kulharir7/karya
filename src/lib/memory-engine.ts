import * as fs from "fs";
import * as path from "path";

/**
 * Karya Memory Engine — OpenClaw-style workspace file memory.
 * 
 * Memory is plain Markdown in the workspace:
 *   workspace/MEMORY.md — curated long-term memory
 *   workspace/memory/YYYY-MM-DD.md — daily logs
 *   workspace/TOOLS.md — tool-specific notes
 *   workspace/RULES.md — agent behavior rules
 * 
 * The agent can read/write these files via tools.
 * Memory persists across sessions and server restarts.
 */

const WORKSPACE_DIR = path.join(process.cwd(), "workspace");
const MEMORY_DIR = path.join(WORKSPACE_DIR, "memory");

/**
 * Initialize workspace directory structure.
 */
export function initWorkspace(): void {
  // Create workspace dirs
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }

  // Create default files if they don't exist
  const defaults: Record<string, string> = {
    "MEMORY.md": `# MEMORY.md — Karya Long-Term Memory

_Curated knowledge that persists across sessions._

## Facts

## Preferences

## Important Notes

---
_Updated by Karya automatically. Edit freely._
`,
    "TOOLS.md": `# TOOLS.md — Tool Notes

_Environment-specific notes about tools and configurations._

## Notes

---
_Add tool-specific learnings here._
`,
    "RULES.md": `# RULES.md — Agent Behavior Rules

_Custom rules for how Karya should behave._

## Rules

1. Be helpful and concise
2. Show progress during multi-step tasks
3. Ask before destructive operations
4. Use Hindi when the user speaks Hindi

---
_Edit this to customize Karya's behavior._
`,
  };

  for (const [filename, content] of Object.entries(defaults)) {
    const filepath = path.join(WORKSPACE_DIR, filename);
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, content, "utf-8");
    }
  }
}

/**
 * Get today's date string for daily log file.
 */
function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Read a workspace file. Returns empty string if not found.
 */
export function readWorkspaceFile(filename: string): string {
  const filepath = path.join(WORKSPACE_DIR, filename);
  try {
    return fs.readFileSync(filepath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Write to a workspace file. Creates parent dirs if needed.
 */
export function writeWorkspaceFile(filename: string, content: string): void {
  const filepath = path.join(WORKSPACE_DIR, filename);
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, content, "utf-8");
}

/**
 * Append to a workspace file.
 */
export function appendWorkspaceFile(filename: string, content: string): void {
  const filepath = path.join(WORKSPACE_DIR, filename);
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(filepath, content, "utf-8");
}

/**
 * Read the main MEMORY.md file.
 */
export function readLongTermMemory(): string {
  return readWorkspaceFile("MEMORY.md");
}

/**
 * Read today's daily log.
 */
export function readTodayLog(): string {
  return readWorkspaceFile(`memory/${getTodayDate()}.md`);
}

/**
 * Read yesterday's daily log.
 */
export function readYesterdayLog(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, "0");
  const day = String(yesterday.getDate()).padStart(2, "0");
  return readWorkspaceFile(`memory/${year}-${month}-${day}.md`);
}

/**
 * Append an entry to today's daily log.
 */
export function logToDaily(entry: string): void {
  const date = getTodayDate();
  const filepath = `memory/${date}.md`;
  const existing = readWorkspaceFile(filepath);

  if (!existing) {
    // Create new daily file with header
    const header = `# ${date} — Karya Daily Log\n\n`;
    writeWorkspaceFile(filepath, header + `- ${new Date().toLocaleTimeString("en-IN")} — ${entry}\n`);
  } else {
    appendWorkspaceFile(filepath, `- ${new Date().toLocaleTimeString("en-IN")} — ${entry}\n`);
  }
}

/**
 * Search memory files for a query (simple text search).
 * Searches MEMORY.md + all daily logs.
 * Returns matching lines with file + line number.
 */
export function searchMemory(query: string, maxResults: number = 10): {
  file: string;
  line: number;
  content: string;
  score: number;
}[] {
  const results: { file: string; line: number; content: string; score: number }[] = [];
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

  // Files to search
  const filesToSearch: string[] = ["MEMORY.md", "TOOLS.md", "RULES.md"];

  // Add daily logs
  if (fs.existsSync(MEMORY_DIR)) {
    const dailyFiles = fs.readdirSync(MEMORY_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, 30); // Last 30 days
    filesToSearch.push(...dailyFiles.map((f) => `memory/${f}`));
  }

  for (const file of filesToSearch) {
    const content = readWorkspaceFile(file);
    if (!content) continue;

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      let score = 0;

      // Exact phrase match
      if (lineLower.includes(queryLower)) {
        score += 10;
      }

      // Word matches
      for (const word of queryWords) {
        if (lineLower.includes(word)) {
          score += 3;
        }
      }

      if (score > 0) {
        results.push({
          file,
          line: i + 1,
          content: lines[i].trim(),
          score,
        });
      }
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

/**
 * Get workspace context for system prompt injection.
 * Returns key memory files content for the agent to be aware of.
 */
export function getWorkspaceContext(): string {
  initWorkspace();

  const parts: string[] = [];

  // Soul (who the agent is)
  const soul = readWorkspaceFile("SOUL.md");
  if (soul.trim()) {
    parts.push(soul);
  }

  // Agents (workspace instructions)
  const agents = readWorkspaceFile("AGENTS.md");
  if (agents.trim()) {
    parts.push(agents);
  }

  // Rules
  const rules = readWorkspaceFile("RULES.md");
  if (rules.trim()) {
    parts.push(`## Agent Rules\n${rules}`);
  }

  // Long-term memory (summarized)
  const memory = readLongTermMemory();
  if (memory.trim()) {
    const truncated = memory.length > 2000 ? memory.slice(0, 2000) + "\n...(truncated)" : memory;
    parts.push(`## Long-Term Memory\n${truncated}`);
  }

  // Today's log (recent context)
  const todayLog = readTodayLog();
  if (todayLog.trim()) {
    const truncated = todayLog.length > 1500 ? todayLog.slice(-1500) + "\n...(showing recent)" : todayLog;
    parts.push(`## Today's Activity Log\n${truncated}`);
  }

  // User info
  const user = readWorkspaceFile("USER.md");
  if (user.trim()) {
    parts.push(user);
  }

  return parts.join("\n\n---\n\n");
}

/**
 * List all memory files with basic stats.
 */
export function listMemoryFiles(): {
  file: string;
  size: number;
  modified: number;
}[] {
  initWorkspace();

  const files: { file: string; size: number; modified: number }[] = [];

  // Root workspace files
  for (const name of ["MEMORY.md", "TOOLS.md", "RULES.md"]) {
    const filepath = path.join(WORKSPACE_DIR, name);
    if (fs.existsSync(filepath)) {
      const stat = fs.statSync(filepath);
      files.push({ file: name, size: stat.size, modified: stat.mtimeMs });
    }
  }

  // Daily logs
  if (fs.existsSync(MEMORY_DIR)) {
    for (const name of fs.readdirSync(MEMORY_DIR).filter((f) => f.endsWith(".md")).sort().reverse()) {
      const filepath = path.join(MEMORY_DIR, name);
      const stat = fs.statSync(filepath);
      files.push({ file: `memory/${name}`, size: stat.size, modified: stat.mtimeMs });
    }
  }

  return files;
}
