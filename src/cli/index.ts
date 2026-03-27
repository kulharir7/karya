#!/usr/bin/env node
/**
 * Karya CLI — Command-line interface for Karya AI Agent
 * 
 * Usage:
 *   karya chat "what's my system info?"     — One-shot chat
 *   karya run "organize my downloads"       — Run task and exit
 *   karya serve                             — Start server (daemon mode)
 *   karya status                            — Check server status
 *   karya tools                             — List all tools
 *   karya sessions                          — List sessions
 *   karya mcp list                          — List MCP servers
 *   karya help                              — Show help
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";

const API_URL = process.env.KARYA_API_URL || "http://localhost:3000";
const VERSION = "0.1.0";

const program = new Command();

// ASCII Art Logo
const logo = `
${chalk.magenta("╔═══════════════════════════════════╗")}
${chalk.magenta("║")}  ${chalk.bold.white("⚡ KARYA")} ${chalk.gray("— AI Computer Agent")}   ${chalk.magenta("║")}
${chalk.magenta("╚═══════════════════════════════════╝")}
`;

/**
 * Make API request
 */
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Stream chat response (SSE)
 */
async function streamChat(message: string, sessionId: string = "cli-session"): Promise<void> {
  const spinner = ora("Thinking...").start();
  
  try {
    // AbortController for timeout (2 minutes)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    
    const response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      spinner.fail("Request failed");
      console.error(chalk.red(`Error: ${response.status} ${response.statusText}`));
      return;
    }

    spinner.stop();
    
    const reader = response.body?.getReader();
    if (!reader) {
      console.error(chalk.red("No response stream"));
      return;
    }

    const decoder = new TextDecoder();
    let fullText = "";
    let toolsShown = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);

          if (parsed.type === "text-delta" && parsed.delta) {
            process.stdout.write(chalk.white(parsed.delta));
            fullText += parsed.delta;
          } else if (parsed.type === "tool-call" && !toolsShown) {
            console.log(chalk.yellow(`\n🔧 Using: ${parsed.tool}`));
            toolsShown = true;
          } else if (parsed.type === "text" && parsed.text && !fullText) {
            console.log(chalk.white(parsed.text));
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    console.log(); // Newline at end
  } catch (err: any) {
    spinner.fail("Error");
    console.error(chalk.red(err.message));
  }
}

// Setup CLI
program
  .name("karya")
  .description("Karya — AI Computer Agent CLI")
  .version(VERSION);

// Chat command
program
  .command("chat <message>")
  .description("Send a message to Karya (one-shot)")
  .option("-s, --session <id>", "Session ID", "cli-session")
  .action(async (message: string, options: { session: string }) => {
    console.log(logo);
    console.log(chalk.gray(`> ${message}\n`));
    await streamChat(message, options.session);
  });

// Run command (alias for chat)
program
  .command("run <task>")
  .description("Run a task and exit")
  .option("-s, --session <id>", "Session ID", "cli-task")
  .action(async (task: string, options: { session: string }) => {
    console.log(logo);
    console.log(chalk.gray(`> Task: ${task}\n`));
    await streamChat(task, options.session);
  });

// Status command
program
  .command("status")
  .description("Check Karya server status")
  .action(async () => {
    const spinner = ora("Checking server...").start();
    
    try {
      const [wsStatus, sessionCount] = await Promise.all([
        apiRequest("/api/ws"),
        apiRequest("/api/sessions").then(r => r.sessions?.length || 0),
      ]);

      spinner.stop();
      console.log(logo);
      console.log(chalk.green("✓ Server is running\n"));
      console.log(chalk.white("  API:        ") + chalk.cyan(API_URL));
      console.log(chalk.white("  WebSocket:  ") + chalk.cyan(wsStatus.url));
      console.log(chalk.white("  WS Clients: ") + chalk.yellow(wsStatus.clients));
      console.log(chalk.white("  Sessions:   ") + chalk.yellow(sessionCount));
    } catch (err: any) {
      spinner.fail("Server not reachable");
      console.error(chalk.red(`\nCannot connect to ${API_URL}`));
      console.log(chalk.gray("Run 'karya serve' to start the server"));
    }
  });

// Tools command
program
  .command("tools")
  .description("List all available tools")
  .action(async () => {
    const spinner = ora("Fetching tools...").start();

    try {
      // Fetch from help page data or hardcoded list
      spinner.stop();
      console.log(logo);
      
      // Hardcoded tool list (matches actual tools in Karya)
      const toolCategories: Record<string, string[]> = {
        "BROWSER": [
          "browser-navigate", "browser-act", "browser-extract", 
          "browser-screenshot", "web-search", "browser-agent"
        ],
        "FILES": [
          "file-read", "file-write", "file-list", "file-move", "file-search",
          "file-read-pdf", "file-resize-image", "file-zip", "file-unzip", 
          "file-batch-rename", "file-size-info"
        ],
        "SHELL": ["shell-execute"],
        "SYSTEM": [
          "system-info", "system-datetime", "system-processes", "system-open-app",
          "system-kill-process", "clipboard-read", "clipboard-write", 
          "system-notify", "system-screenshot", "analyze-image"
        ],
        "CODE": ["code-write", "code-execute", "code-analyze"],
        "DATA": ["api-call", "data-csv-parse", "data-json-query", "data-transform"],
        "MEMORY": [
          "memory-search", "memory-read", "memory-write", 
          "memory-log", "memory-list", "memory-recall"
        ],
        "GIT": ["git-status", "git-commit", "git-push", "git-log", "git-diff"],
        "SCHEDULER": ["task-schedule", "task-list", "task-cancel"],
        "SKILLS": ["skill-list", "skill-match", "skill-load", "skill-create"],
        "WORKFLOWS": [
          "workflow-list", "workflow-run", "workflow-status",
          "workflow-history", "workflow-resume", "workflow-cancel", "workflow-stats"
        ],
        "AGENTS": [
          "delegate-browser-agent", "delegate-file-agent", "delegate-coder-agent",
          "delegate-researcher-agent", "delegate-data-analyst-agent"
        ],
      };
      
      const totalTools = Object.values(toolCategories).flat().length;
      console.log(chalk.bold(`\n📦 ${totalTools} Tools Available\n`));

      for (const [cat, toolList] of Object.entries(toolCategories)) {
        console.log(chalk.yellow(`\n${cat} (${toolList.length})`));
        for (const t of toolList) {
          console.log(chalk.gray(`  • ${t}`));
        }
      }
    } catch (err: any) {
      spinner.fail("Error");
      console.error(chalk.red(err.message));
    }
  });

// Sessions command
program
  .command("sessions")
  .description("List all sessions")
  .action(async () => {
    const spinner = ora("Fetching sessions...").start();

    try {
      const data = await apiRequest("/api/sessions");
      spinner.stop();

      console.log(logo);
      const sessions = data.sessions || [];
      console.log(chalk.bold(`\n💬 ${sessions.length} Sessions\n`));

      for (const session of sessions) {
        const date = new Date(session.updatedAt || session.createdAt);
        console.log(
          chalk.cyan(`  ${session.id}`) +
          chalk.gray(` — ${session.name || "Untitled"}`) +
          chalk.gray(` (${date.toLocaleDateString()})`)
        );
      }

      if (sessions.length === 0) {
        console.log(chalk.gray("  No sessions yet"));
      }
    } catch (err: any) {
      spinner.fail("Error");
      console.error(chalk.red(err.message));
    }
  });

// MCP command
program
  .command("mcp <action>")
  .description("MCP server management (list, test)")
  .action(async (action: string) => {
    const spinner = ora("Fetching MCP servers...").start();

    try {
      if (action === "list") {
        const data = await apiRequest("/api/mcp?action=list");
        spinner.stop();

        console.log(logo);
        const servers = data.servers || [];
        console.log(chalk.bold(`\n🔌 ${servers.length} MCP Servers\n`));

        for (const server of servers) {
          const status = server.enabled ? chalk.green("●") : chalk.gray("○");
          console.log(`  ${status} ${chalk.cyan(server.name)} — ${chalk.gray(server.url)}`);
        }

        if (servers.length === 0) {
          console.log(chalk.gray("  No MCP servers configured"));
        }
      } else {
        spinner.stop();
        console.log(chalk.yellow(`Unknown action: ${action}`));
        console.log(chalk.gray("Available: list"));
      }
    } catch (err: any) {
      spinner.fail("Error");
      console.error(chalk.red(err.message));
    }
  });

// Serve command (placeholder — actual server is Next.js)
program
  .command("serve")
  .description("Start Karya server")
  .option("-p, --port <port>", "Port number", "3000")
  .action((options: { port: string }) => {
    console.log(logo);
    console.log(chalk.yellow("Starting Karya server...\n"));
    console.log(chalk.gray("Run this in the karya directory:"));
    console.log(chalk.cyan(`  npm run dev -- -p ${options.port}\n`));
    console.log(chalk.gray("Or for production:"));
    console.log(chalk.cyan("  npm run build && npm start"));
  });

// Help (default)
program
  .command("help")
  .description("Show help")
  .action(() => {
    console.log(logo);
    program.outputHelp();
  });

// Parse arguments
program.parse();

// Show help if no command
if (!process.argv.slice(2).length) {
  console.log(logo);
  program.outputHelp();
}
