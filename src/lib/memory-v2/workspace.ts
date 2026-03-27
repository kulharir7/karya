/**
 * Karya Memory V2 — Workspace File Manager
 * 
 * Files are the source of truth:
 * - workspace/MEMORY.md — Long-term memory
 * - workspace/memory/YYYY-MM-DD.md — Daily logs
 * - workspace/USER.md — User info
 * - workspace/TOOLS.md — Tool notes
 * 
 * Indices are derived from files and can be rebuilt anytime.
 */

import * as fs from "fs";
import * as path from "path";

export interface MemoryFile {
  path: string;
  name: string;
  content: string;
  size: number;
  modifiedAt: number;
}

export class WorkspaceManager {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.ensureDirectories();
  }

  /**
   * Ensure workspace directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      this.workspacePath,
      path.join(this.workspacePath, "memory"),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Get all memory files
   */
  getAllFiles(): MemoryFile[] {
    const files: MemoryFile[] = [];

    // Root files
    const rootFiles = ["MEMORY.md", "USER.md", "TOOLS.md", "RULES.md"];
    for (const name of rootFiles) {
      const filePath = path.join(this.workspacePath, name);
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        files.push({
          path: filePath,
          name,
          content: fs.readFileSync(filePath, "utf-8"),
          size: stat.size,
          modifiedAt: stat.mtimeMs,
        });
      }
    }

    // Daily logs
    const memoryDir = path.join(this.workspacePath, "memory");
    if (fs.existsSync(memoryDir)) {
      const entries = fs.readdirSync(memoryDir);
      for (const entry of entries) {
        if (entry.endsWith(".md")) {
          const filePath = path.join(memoryDir, entry);
          const stat = fs.statSync(filePath);
          files.push({
            path: filePath,
            name: `memory/${entry}`,
            content: fs.readFileSync(filePath, "utf-8"),
            size: stat.size,
            modifiedAt: stat.mtimeMs,
          });
        }
      }
    }

    return files;
  }

  /**
   * Read a specific file
   */
  readFile(relativePath: string): string | null {
    const filePath = path.join(this.workspacePath, relativePath);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    return null;
  }

  /**
   * Write to a file
   */
  writeFile(relativePath: string, content: string): void {
    const filePath = path.join(this.workspacePath, relativePath);
    const dir = path.dirname(filePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, content, "utf-8");
  }

  /**
   * Append to a file
   */
  appendFile(relativePath: string, content: string): void {
    const filePath = path.join(this.workspacePath, relativePath);
    const dir = path.dirname(filePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.appendFileSync(filePath, content, "utf-8");
  }

  /**
   * Get today's log file path
   */
  getTodayLogPath(): string {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return `memory/${date}.md`;
  }

  /**
   * Append to today's log
   */
  logToday(entry: string): void {
    const logPath = this.getTodayLogPath();
    const timestamp = new Date().toLocaleTimeString();
    
    let content = "";
    const fullPath = path.join(this.workspacePath, logPath);
    
    // Create header if file doesn't exist
    if (!fs.existsSync(fullPath)) {
      const date = new Date().toISOString().split("T")[0];
      content = `# ${date} — Daily Log\n\n`;
    }
    
    content += `## ${timestamp}\n${entry}\n\n`;
    this.appendFile(logPath, content);
  }

  /**
   * Read MEMORY.md
   */
  getLongTermMemory(): string {
    return this.readFile("MEMORY.md") || "";
  }

  /**
   * Append to MEMORY.md
   */
  appendToLongTermMemory(content: string): void {
    this.appendFile("MEMORY.md", `\n${content}\n`);
  }

  /**
   * Get recent daily logs (last N days)
   */
  getRecentLogs(days: number = 7): MemoryFile[] {
    const memoryDir = path.join(this.workspacePath, "memory");
    if (!fs.existsSync(memoryDir)) return [];

    const entries = fs.readdirSync(memoryDir)
      .filter(e => e.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort()
      .reverse()
      .slice(0, days);

    return entries.map(entry => {
      const filePath = path.join(memoryDir, entry);
      const stat = fs.statSync(filePath);
      return {
        path: filePath,
        name: `memory/${entry}`,
        content: fs.readFileSync(filePath, "utf-8"),
        size: stat.size,
        modifiedAt: stat.mtimeMs,
      };
    });
  }

  /**
   * Get workspace context for agent (MEMORY.md + today + yesterday)
   */
  getContext(): string {
    const parts: string[] = [];

    // Long-term memory
    const memory = this.getLongTermMemory();
    if (memory) {
      parts.push("## MEMORY.md (Long-term Memory)\n" + memory);
    }

    // Recent logs
    const recentLogs = this.getRecentLogs(2);
    for (const log of recentLogs) {
      parts.push(`## ${log.name}\n${log.content}`);
    }

    return parts.join("\n\n---\n\n");
  }
}
