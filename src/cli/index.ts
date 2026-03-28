#!/usr/bin/env node
/**
 * Karya CLI — Command-line interface for Karya AI Agent
 * 
 * Usage:
 *   karya                                    — Interactive REPL (default)
 *   karya -i                                 — Interactive REPL (explicit)
 *   karya chat "what's my system info?"      — One-shot chat
 *   karya run "organize my downloads"        — Run task and exit
 *   karya tool <id> [--args '{}']            — Execute a tool directly
 *   karya serve [-p 3000]                    — Start server
 *   karya status                             — Server health + stats
 *   karya sessions                           — List sessions
 *   karya sessions delete <id>               — Delete a session
 *   karya tools [category]                   — List tools (dynamic from API)
 *   karya tools search <query>               — Search tools
 *   karya agents                             — List agents
 *   karya tasks                              — List scheduled tasks
 *   karya workflows                          — List workflow templates
 *   karya mcp list                           — MCP servers
 *   karya memory search <query>              — Search memory
 *   karya token create <name>                — Generate API token
 *   karya token list                         — List tokens
 *   karya config                             — Show config
 *   karya config set <key> <value>           — Update config
 *   karya help                               — Show help
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { spawn } from "child_process";
import {
  setConfig,
  getConfig,
  isServerReachable,
  streamChat,
  listSessions,
  deleteSession,
  listTools,
  listToolsByCategory,
  searchTools,
  runTool,
  listAgents,
  listTasks,
  listWorkflows,
  listMCPServers,
  searchMemory,
  getDailyLog,
  getStatus,
  getHealth,
  createToken,
  listTokens,
  type StreamEvents,
} from "./api-client.js";
import {
  LOGO,
  header,
  printStatus,
  printSessions,
  printTools,
  printAgents,
  printTasks,
  printWorkflows,
  printMCPServers,
  printToolCall,
  printToolResult,
  printStreamDone,
  printStreamError,
  resetStreamDisplay,
} from "./formatters.js";
import { startREPL } from "./repl.js";

const VERSION = "0.5.0";

const program = new Command();

// ============================================
// GLOBAL OPTIONS
// ============================================

program
  .name("karya")
  .description("⚡ Karya — AI Computer Agent CLI")
  .version(VERSION)
  .option("-u, --url <url>", "Server URL", process.env.KARYA_API_URL || "http://localhost:3000")
  .option("-t, --token <token>", "API token", process.env.KARYA_TOKEN || "")
  .option("-s, --session <id>", "Session ID", process.env.KARYA_SESSION || "cli-default")
  .option("-i, --interactive", "Start interactive REPL")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    setConfig({
      apiUrl: opts.url,
      token: opts.token,
      sessionId: opts.session,
    });
  });

// ============================================
// CHAT — One-shot message
// ============================================

program
  .command("chat <message>")
  .description("Send a message to Karya (one-shot)")
  .action(async (message: string) => {
    console.log(LOGO);
    console.log(chalk.gray(`  > ${message}\n`));
    await oneShot(message);
  });

// ============================================
// RUN — Alias for chat (task-oriented wording)
// ============================================

program
  .command("run <task>")
  .description("Run a task and exit")
  .action(async (task: string) => {
    console.log(LOGO);
    console.log(chalk.gray(`  > Task: ${task}\n`));
    await oneShot(task);
  });

// ============================================
// TOOL — Execute a specific tool
// ============================================

program
  .command("tool <id>")
  .description("Execute a tool directly")
  .option("-a, --args <json>", "Tool arguments as JSON", "{}")
  .action(async (id: string, opts: { args: string }) => {
    console.log(LOGO);
    const spinner = ora({ text: `Running ${id}...`, indent: 2 }).start();

    try {
      let args = {};
      try {
        args = JSON.parse(opts.args);
      } catch {
        spinner.fail("Invalid JSON for --args");
        return;
      }

      const result = await runTool(id, args);
      spinner.stop();

      header(`🔧 ${id}`);
      if (result.result) {
        console.log(chalk.white(`  ${result.result}`));
      }
      if (result.toolCalls?.length) {
        for (const tc of result.toolCalls) {
          console.log(chalk.yellow(`  Tool: ${tc.toolName}`));
          if (tc.result) {
            console.log(chalk.gray(`  Result: ${JSON.stringify(tc.result).slice(0, 200)}`));
          }
        }
      }
      console.log(chalk.gray(`\n  ⏱️  ${result.durationMs}ms`));
    } catch (err: any) {
      spinner.fail(err.message);
    }
  });

// ============================================
// SERVE — Start server
// ============================================

program
  .command("serve")
  .description("Start Karya server")
  .option("-p, --port <port>", "Port number", "3000")
  .action((opts: { port: string }) => {
    console.log(LOGO);
    console.log(chalk.yellow("  Starting Karya server...\n"));

    const child = spawn("npx", ["next", "dev", "--port", opts.port], {
      cwd: process.env.KARYA_DIR || process.cwd(),
      stdio: "inherit",
      shell: true,
    });

    child.on("error", (err) => {
      console.error(chalk.red(`  Failed to start: ${err.message}`));
      console.log(chalk.gray("  Make sure you're in the karya directory, or set KARYA_DIR"));
    });

    child.on("exit", (code) => {
      process.exit(code || 0);
    });

    // Forward Ctrl+C
    process.on("SIGINT", () => {
      child.kill("SIGINT");
    });
  });

// ============================================
// STATUS
// ============================================

program
  .command("status")
  .description("Server health and system status")
  .action(async () => {
    console.log(LOGO);
    const spinner = ora({ text: "Checking server...", indent: 2 }).start();

    try {
      const reachable = await isServerReachable();
      if (!reachable) {
        spinner.fail("Server not reachable");
        console.log(chalk.red(`\n  Cannot connect to ${getConfig().apiUrl}`));
        console.log(chalk.gray("  Start the server: karya serve"));
        return;
      }

      const status = await getStatus();
      spinner.stop();
      printStatus(status);
    } catch (err: any) {
      spinner.fail(err.message);
    }
  });

// ============================================
// SESSIONS
// ============================================

const sessionsCmd = program
  .command("sessions")
  .description("List all sessions");

sessionsCmd.action(async () => {
  console.log(LOGO);
  const spinner = ora({ text: "Fetching sessions...", indent: 2 }).start();
  try {
    const sessions = await listSessions();
    spinner.stop();
    header("💬 Sessions");
    printSessions(sessions);
  } catch (err: any) {
    spinner.fail(err.message);
  }
});

sessionsCmd
  .command("delete <id>")
  .description("Delete a session")
  .action(async (id: string) => {
    try {
      await deleteSession(id);
      console.log(chalk.green(`  ✓ Deleted: ${id}`));
    } catch (err: any) {
      console.log(chalk.red(`  ❌ ${err.message}`));
    }
  });

// ============================================
// TOOLS
// ============================================

const toolsCmd = program
  .command("tools [category]")
  .description("List all tools or by category");

toolsCmd.action(async (category?: string) => {
  console.log(LOGO);
  const spinner = ora({ text: "Fetching tools...", indent: 2 }).start();

  try {
    if (category) {
      const data = await listToolsByCategory(category);
      spinner.stop();
      header(`🔧 Tools — ${category}`);
      if (data.tools?.length) {
        for (const t of data.tools) {
          console.log(`  ${chalk.gray("•")} ${chalk.white(t)}`);
        }
        console.log(chalk.gray(`\n  ${data.count} tools`));
      } else {
        console.log(chalk.gray("  No tools in this category"));
      }
    } else {
      const data = await listTools();
      spinner.stop();
      header("🔧 Tools");
      printTools(data);
    }
  } catch (err: any) {
    spinner.fail(err.message);
  }
});

toolsCmd
  .command("search <query>")
  .description("Search tools by name")
  .action(async (query: string) => {
    try {
      const data = await searchTools(query);
      header(`🔍 Tools matching "${query}"`);
      if (data.tools?.length) {
        for (const t of data.tools) {
          console.log(`  ${chalk.gray("•")} ${chalk.white(t)}`);
        }
        console.log(chalk.gray(`\n  ${data.count} results`));
      } else {
        console.log(chalk.gray("  No tools found"));
      }
    } catch (err: any) {
      console.log(chalk.red(`  ❌ ${err.message}`));
    }
  });

// ============================================
// AGENTS
// ============================================

program
  .command("agents")
  .description("List all agents")
  .action(async () => {
    console.log(LOGO);
    try {
      const data = await listAgents();
      header("🤖 Agents");
      printAgents(data.agents || []);
    } catch (err: any) {
      console.log(chalk.red(`  ❌ ${err.message}`));
    }
  });

// ============================================
// TASKS
// ============================================

program
  .command("tasks")
  .description("List scheduled tasks")
  .action(async () => {
    console.log(LOGO);
    try {
      const data = await listTasks();
      header("📋 Scheduled Tasks");
      printTasks(data.tasks || []);
    } catch (err: any) {
      console.log(chalk.red(`  ❌ ${err.message}`));
    }
  });

// ============================================
// WORKFLOWS
// ============================================

program
  .command("workflows")
  .description("List workflow templates")
  .action(async () => {
    console.log(LOGO);
    try {
      const data = await listWorkflows();
      header("⚙️ Workflow Templates");
      printWorkflows(data.templates || []);
    } catch (err: any) {
      console.log(chalk.red(`  ❌ ${err.message}`));
    }
  });

// ============================================
// MCP
// ============================================

const mcpCmd = program
  .command("mcp")
  .description("MCP server management");

mcpCmd
  .command("list")
  .description("List MCP servers")
  .action(async () => {
    console.log(LOGO);
    try {
      const data = await listMCPServers();
      header("🔌 MCP Servers");
      printMCPServers(data.servers || []);
    } catch (err: any) {
      console.log(chalk.red(`  ❌ ${err.message}`));
    }
  });

// Default mcp → list
mcpCmd.action(async () => {
  console.log(LOGO);
  try {
    const data = await listMCPServers();
    header("🔌 MCP Servers");
    printMCPServers(data.servers || []);
  } catch (err: any) {
    console.log(chalk.red(`  ❌ ${err.message}`));
  }
});

// ============================================
// MEMORY
// ============================================

const memoryCmd = program
  .command("memory")
  .description("Memory operations");

memoryCmd
  .command("search <query>")
  .description("Search memory files")
  .action(async (query: string) => {
    console.log(LOGO);
    try {
      const data = await searchMemory(query);
      header(`🧠 Memory — "${query}"`);
      const results = data.results || [];
      if (results.length === 0) {
        console.log(chalk.gray("  No results found"));
      } else {
        for (const r of results) {
          console.log(`  ${chalk.cyan(r.file || "?")} ${chalk.gray(`(score: ${r.score || "?"})`)}`);
          if (r.snippet) {
            console.log(`    ${chalk.white(r.snippet.slice(0, 200))}`);
          }
        }
      }
    } catch (err: any) {
      console.log(chalk.red(`  ❌ ${err.message}`));
    }
  });

memoryCmd
  .command("today")
  .description("Show today's daily log")
  .action(async () => {
    console.log(LOGO);
    try {
      const data = await getDailyLog();
      header(`📝 Daily Log — ${data.date}`);
      if (data.content) {
        console.log(chalk.white(`  ${data.content.slice(0, 2000)}`));
      } else {
        console.log(chalk.gray("  No entries today"));
      }
    } catch (err: any) {
      console.log(chalk.red(`  ❌ ${err.message}`));
    }
  });

// ============================================
// TOKEN
// ============================================

const tokenCmd = program
  .command("token")
  .description("API token management");

tokenCmd
  .command("create <name>")
  .description("Generate a new API token")
  .option("--scopes <scopes>", "Comma-separated scopes", "*")
  .action(async (name: string, opts: { scopes: string }) => {
    console.log(LOGO);
    try {
      const scopes = opts.scopes.split(",").map((s: string) => s.trim());
      const result = await createToken(name, scopes);

      header("🔑 New API Token");
      console.log(chalk.bold.yellow(`\n  ${result.token}\n`));
      console.log(chalk.red("  ⚠️  Save this now — it won't be shown again!\n"));
      console.log(`  ${chalk.gray("Name:")}   ${result.name}`);
      console.log(`  ${chalk.gray("Scopes:")} ${result.scopes?.join(", ") || "*"}`);
    } catch (err: any) {
      console.log(chalk.red(`  ❌ ${err.message}`));
    }
  });

tokenCmd
  .command("list")
  .description("List API tokens")
  .action(async () => {
    console.log(LOGO);
    try {
      const data = await listTokens();
      header("🔑 API Tokens");
      const tokens = data.tokens || [];
      if (tokens.length === 0) {
        console.log(chalk.gray("  No tokens. Create one: karya token create <name>"));
      } else {
        for (const t of tokens) {
          console.log(`  ${chalk.cyan(t.name)} — ${chalk.gray(t.tokenPreview)}`);
          console.log(`    ${chalk.gray(`Scopes: ${t.scopes?.join(", ")}`)} · ${chalk.gray(`Used: ${t.requestCount}x`)}`);
        }
      }
    } catch (err: any) {
      console.log(chalk.red(`  ❌ ${err.message}`));
    }
  });

// ============================================
// CONFIG
// ============================================

const configCmd = program
  .command("config")
  .description("Show or set CLI config");

configCmd.action(() => {
  console.log(LOGO);
  const cfg = getConfig();
  header("⚙️ CLI Config");
  console.log(`  ${chalk.white("API URL:")}  ${chalk.cyan(cfg.apiUrl)}`);
  console.log(`  ${chalk.white("Token:")}    ${cfg.token ? chalk.green(cfg.token.slice(0, 10) + "***") : chalk.gray("none")}`);
  console.log(`  ${chalk.white("Session:")}  ${chalk.cyan(cfg.sessionId)}`);
  console.log();
  console.log(chalk.gray("  Environment variables:"));
  console.log(chalk.gray("    KARYA_API_URL  — Server URL"));
  console.log(chalk.gray("    KARYA_TOKEN    — API token"));
  console.log(chalk.gray("    KARYA_SESSION  — Default session ID"));
  console.log(chalk.gray("    KARYA_DIR      — Server directory (for 'karya serve')"));
});

configCmd
  .command("set <key> <value>")
  .description("Set a config value (url, token, session)")
  .action((key: string, value: string) => {
    const keyMap: Record<string, keyof ReturnType<typeof getConfig>> = {
      url: "apiUrl",
      "api-url": "apiUrl",
      token: "token",
      session: "sessionId",
    };

    const configKey = keyMap[key];
    if (!configKey) {
      console.log(chalk.yellow(`  Unknown key: ${key}`));
      console.log(chalk.gray(`  Available: ${Object.keys(keyMap).join(", ")}`));
      return;
    }

    setConfig({ [configKey]: value });
    console.log(chalk.green(`  ✓ ${key} = ${value}`));
  });

// ============================================
// ONE-SHOT CHAT HELPER
// ============================================

async function oneShot(message: string): Promise<void> {
  const spinner = ora({ text: chalk.gray("Thinking..."), spinner: "dots", indent: 2 }).start();
  let firstDelta = true;
  resetStreamDisplay();

  const events: StreamEvents = {
    onTextDelta: (delta) => {
      if (firstDelta) {
        spinner.stop();
        process.stdout.write("  ");
        firstDelta = false;
      }
      process.stdout.write(chalk.white(delta.replace(/\n/g, "\n  ")));
    },
    onToolCall: (toolName) => {
      if (firstDelta) { spinner.stop(); firstDelta = false; }
      printToolCall(toolName);
    },
    onToolResult: (toolName) => {
      printToolResult(toolName);
    },
    onDone: (info) => {
      if (firstDelta) spinner.stop();
      printStreamDone(info);
    },
    onError: (error) => {
      spinner.stop();
      printStreamError(error);
    },
  };

  try {
    const cfg = getConfig();
    await streamChat(message, cfg.sessionId, events);
  } catch (err: any) {
    spinner.fail(err.message);
  }
}

// ============================================
// PARSE & DEFAULT BEHAVIOR
// ============================================

// Parse arguments
program.parse();

// If no command given → interactive REPL
const userArgs = process.argv.slice(2);
const opts = program.opts();

if (userArgs.length === 0 || opts.interactive) {
  startREPL(opts.session);
}
