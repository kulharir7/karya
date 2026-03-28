/**
 * CLI Formatters — Pretty print for terminal output
 * 
 * All display logic lives here so commands stay clean.
 * Uses chalk for colors, handles alignment and truncation.
 */

import chalk from "chalk";

// ============================================
// LOGO & HEADERS
// ============================================

export const LOGO = `
${chalk.magenta("╔═══════════════════════════════════╗")}
${chalk.magenta("║")}  ${chalk.bold.white("⚡ KARYA")} ${chalk.gray("— AI Computer Agent")}   ${chalk.magenta("║")}
${chalk.magenta("╚═══════════════════════════════════╝")}`;

export const LOGO_MINI = chalk.magenta("⚡") + chalk.bold.white(" KARYA");

export function header(title: string): void {
  console.log(`\n${chalk.bold.white(title)}`);
  console.log(chalk.gray("─".repeat(Math.max(40, title.length + 4))));
}

export function subHeader(title: string): void {
  console.log(`\n  ${chalk.yellow(title)}`);
}

// ============================================
// STATUS
// ============================================

export function printStatus(status: any): void {
  header("📊 System Status");

  // Server
  const srv = status.server || {};
  console.log(`\n  ${chalk.white("Server")}    ${chalk.green("● running")}`);
  console.log(`  ${chalk.gray("Version")}   ${chalk.cyan(srv.version || "?")}`);
  console.log(`  ${chalk.gray("Node.js")}   ${chalk.cyan(srv.nodeVersion || "?")}`);
  console.log(`  ${chalk.gray("Uptime")}    ${chalk.cyan(srv.uptimeHuman || `${srv.uptime || 0}s`)}`);

  // Counts
  console.log();
  const counts = [
    { label: "Tools", value: status.tools?.total || 0, icon: "🔧" },
    { label: "Agents", value: status.agents?.total || 0, icon: "🤖" },
    { label: "Sessions", value: status.sessions?.total || 0, icon: "💬" },
  ];
  for (const c of counts) {
    console.log(`  ${c.icon} ${chalk.white(c.label.padEnd(12))} ${chalk.yellow(c.value)}`);
  }

  // Services
  console.log();
  const services = [
    { label: "Memory", status: status.memory || "?" },
    { label: "Scheduler", status: status.scheduler?.status || "?" },
    { label: "MCP", status: status.mcp?.status || "?" },
    { label: "WebSocket", status: status.websocket?.status || "?" },
  ];
  for (const s of services) {
    const dot = s.status === "active" || s.status === "running"
      ? chalk.green("●")
      : s.status === "error" ? chalk.red("●") : chalk.gray("○");
    console.log(`  ${dot} ${chalk.white(s.label.padEnd(12))} ${chalk.gray(s.status)}`);
  }

  // Tool categories
  if (status.tools?.categories) {
    console.log();
    console.log(`  ${chalk.gray("Tool categories:")}`);
    for (const [cat, count] of Object.entries(status.tools.categories)) {
      console.log(`    ${chalk.gray("•")} ${chalk.white(cat.padEnd(14))} ${chalk.yellow(count as number)}`);
    }
  }

  console.log();
}

// ============================================
// SESSIONS
// ============================================

export function printSessions(sessions: any[], activeId?: string): void {
  if (sessions.length === 0) {
    console.log(chalk.gray("  No sessions yet. Start chatting to create one."));
    return;
  }

  for (const s of sessions) {
    const active = s.id === activeId;
    const marker = active ? chalk.green("▸ ") : "  ";
    const name = truncate(s.name || "Untitled", 30);
    const msgs = chalk.gray(`${s.messageCount || 0} msgs`);
    const date = formatDate(s.updatedAt || s.createdAt);

    console.log(
      `${marker}${active ? chalk.green(name) : chalk.white(name)}` +
      `  ${msgs}  ${chalk.gray(date)}`
    );
    if (active) {
      console.log(`    ${chalk.gray("id:")} ${chalk.cyan(s.id)}`);
    }
  }
}

// ============================================
// TOOLS
// ============================================

export function printTools(data: any): void {
  const categories = data.categories || {};
  const total = data.total || 0;

  console.log(`  ${chalk.bold.yellow(total)} tools across ${chalk.yellow(Object.keys(categories).length)} categories\n`);

  for (const [cat, info] of Object.entries(categories) as [string, any][]) {
    const tools: string[] = info.tools || info;
    const count = info.count || tools.length;
    console.log(`  ${chalk.yellow(cat.toUpperCase())} ${chalk.gray(`(${count})`)}`);
    for (const t of tools) {
      console.log(`    ${chalk.gray("•")} ${chalk.white(t)}`);
    }
    console.log();
  }
}

// ============================================
// AGENTS
// ============================================

export function printAgents(agents: any[]): void {
  for (const a of agents) {
    console.log(
      `  ${a.icon || "🤖"} ${chalk.bold.white(a.name)}` +
      `  ${chalk.gray(`(${a.id})`)}`
    );
    console.log(`    ${chalk.gray(a.role || "")}`);
    if (a.specialty) {
      console.log(`    ${chalk.gray("Specialty:")} ${chalk.cyan(a.specialty.join(", "))}`);
    }
    console.log();
  }
}

// ============================================
// MESSAGES (HISTORY)
// ============================================

export function printMessages(messages: any[]): void {
  if (messages.length === 0) {
    console.log(chalk.gray("  No messages in this session."));
    return;
  }

  for (const m of messages) {
    const time = formatTime(m.timestamp);
    if (m.role === "user") {
      console.log(`\n  ${chalk.gray(time)} ${chalk.green("You")}`);
      console.log(`  ${chalk.white(truncate(m.content, 200))}`);
    } else if (m.role === "assistant") {
      console.log(`\n  ${chalk.gray(time)} ${chalk.magenta("Karya")}`);
      // Show tool calls if present
      if (m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          console.log(`  ${chalk.yellow("🔧")} ${chalk.yellow(tc.toolName)}`);
        }
      }
      console.log(`  ${chalk.white(truncate(m.content, 500))}`);
    }
  }
  console.log();
}

// ============================================
// TASKS
// ============================================

export function printTasks(tasks: any[]): void {
  if (tasks.length === 0) {
    console.log(chalk.gray("  No scheduled tasks."));
    return;
  }

  for (const t of tasks) {
    const enabled = t.enabled
      ? chalk.green("●")
      : chalk.gray("○");
    const type = chalk.gray(`[${t.type}]`);

    console.log(
      `  ${enabled} ${chalk.white(truncate(t.name || t.task, 40))} ${type}`
    );
    if (t.lastRun) {
      console.log(`    ${chalk.gray("Last run:")} ${formatDate(t.lastRun)}`);
    }
  }
}

// ============================================
// MCP SERVERS
// ============================================

export function printMCPServers(servers: any[]): void {
  if (servers.length === 0) {
    console.log(chalk.gray("  No MCP servers configured."));
    return;
  }

  for (const s of servers) {
    const status = s.enabled ? chalk.green("●") : chalk.gray("○");
    console.log(`  ${status} ${chalk.cyan(s.name)} — ${chalk.gray(s.url)}`);
    if (s.transport) {
      console.log(`    ${chalk.gray(`transport: ${s.transport}`)}`);
    }
  }
}

// ============================================
// WORKFLOWS
// ============================================

export function printWorkflows(templates: any[]): void {
  if (templates.length === 0) {
    console.log(chalk.gray("  No workflow templates."));
    return;
  }

  for (const t of templates) {
    console.log(
      `  ${chalk.cyan(t.id)} — ${chalk.white(t.name || t.id)}`
    );
    if (t.description) {
      console.log(`    ${chalk.gray(t.description)}`);
    }
    if (t.pattern) {
      console.log(`    ${chalk.gray("Pattern:")} ${chalk.yellow(t.pattern)}`);
    }
  }
}

// ============================================
// STREAMING DISPLAY
// ============================================

/** Tools shown during streaming — tracks which tools have been displayed */
const displayedTools = new Set<string>();

export function resetStreamDisplay(): void {
  displayedTools.clear();
}

export function printToolCall(toolName: string): void {
  if (!displayedTools.has(toolName)) {
    displayedTools.add(toolName);
    console.log(chalk.yellow(`\n  🔧 ${toolName}`));
  }
}

export function printToolResult(toolName: string): void {
  console.log(chalk.green(`  ✅ ${toolName}`));
}

export function printStreamDone(info: {
  durationMs?: number;
  toolCount?: number;
  tokenEstimate?: number;
}): void {
  const parts: string[] = [];
  if (info.durationMs) parts.push(`${(info.durationMs / 1000).toFixed(1)}s`);
  if (info.toolCount) parts.push(`${info.toolCount} tools`);
  if (info.tokenEstimate) parts.push(`~${info.tokenEstimate} tokens`);

  if (parts.length > 0) {
    console.log(chalk.gray(`\n  ⏱️  ${parts.join(" · ")}`));
  }
  console.log();
}

export function printStreamError(error: string): void {
  console.log(chalk.red(`\n  ❌ ${error}`));
}

// ============================================
// REPL PROMPT
// ============================================

export function printWelcome(sessionId: string, apiUrl: string): void {
  console.log(LOGO);
  console.log(chalk.gray(`  Server: ${apiUrl}`));
  console.log(chalk.gray(`  Session: ${sessionId}`));
  console.log(chalk.gray(`  Type /help for commands, /exit to quit\n`));
}

export function printREPLHelp(): void {
  console.log(`
  ${chalk.bold.white("Chat Commands")}
  ${chalk.gray("  Just type a message to chat with Karya")}

  ${chalk.bold.white("Slash Commands")}
  ${chalk.cyan("/sessions")}          List all sessions
  ${chalk.cyan("/switch")} ${chalk.gray("<id>")}        Switch to another session
  ${chalk.cyan("/new")} ${chalk.gray("[name]")}         Create new session
  ${chalk.cyan("/rename")} ${chalk.gray("<name>")}      Rename current session
  ${chalk.cyan("/clear")}             Clear current session messages
  ${chalk.cyan("/history")} ${chalk.gray("[n]")}        Show last N messages (default 10)
  ${chalk.cyan("/delete")} ${chalk.gray("<id>")}        Delete a session

  ${chalk.cyan("/tools")} ${chalk.gray("[category]")}   List tools (optionally by category)
  ${chalk.cyan("/agents")}            List agents
  ${chalk.cyan("/tasks")}             List scheduled tasks
  ${chalk.cyan("/workflows")}         List workflow templates
  ${chalk.cyan("/mcp")}               List MCP servers
  ${chalk.cyan("/memory")} ${chalk.gray("<query>")}     Search memory
  ${chalk.cyan("/status")}            Server status

  ${chalk.cyan("/abort")}             Cancel running request
  ${chalk.cyan("/config")}            Show CLI config
  ${chalk.cyan("/help")}              Show this help
  ${chalk.cyan("/exit")}              Quit
`);
}

// ============================================
// UTILITIES
// ============================================

function truncate(str: string, max: number): string {
  if (!str) return "";
  // Remove newlines for single-line display
  const clean = str.replace(/\n/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 3) + "..." : clean;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const now = new Date();

  // Today
  if (d.toDateString() === now.toDateString()) {
    return `Today ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTime(timestamp: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
