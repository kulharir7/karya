/**
 * Karya CLI REPL — Interactive chat mode
 * 
 * This is the main interactive experience:
 *   $ karya          # starts REPL
 *   $ karya -i       # also starts REPL
 * 
 * Features:
 * - Persistent session across messages
 * - Slash commands (/sessions, /tools, /switch, /history, etc.)
 * - Streaming response display
 * - Abort with Ctrl+C (single press = cancel request, double = exit)
 * - History via readline
 * - Auto-reconnect awareness
 */

import * as readline from "readline";
import chalk from "chalk";
import ora from "ora";
import {
  getConfig,
  setConfig,
  streamChat,
  isServerReachable,
  listSessions,
  createSession,
  renameSession,
  clearSession,
  deleteSession,
  getMessages,
  listTools,
  listToolsByCategory,
  searchTools,
  listAgents,
  listTasks,
  listWorkflows,
  listMCPServers,
  searchMemory,
  getStatus,
  type StreamEvents,
} from "./api-client.js";
import {
  printWelcome,
  printREPLHelp,
  printSessions,
  printTools,
  printAgents,
  printMessages,
  printTasks,
  printWorkflows,
  printMCPServers,
  printStatus,
  printToolCall,
  printToolResult,
  printStreamDone,
  printStreamError,
  resetStreamDisplay,
  header,
} from "./formatters.js";

// ============================================
// STATE
// ============================================

let currentSessionId: string;
let isProcessing = false;
let abortController: AbortController | null = null;
let rl: readline.Interface;

// ============================================
// MAIN ENTRY
// ============================================

export async function startREPL(sessionId?: string): Promise<void> {
  currentSessionId = sessionId || getConfig().sessionId;

  // Check server connectivity
  const spinner = ora("Connecting to Karya server...").start();
  const reachable = await isServerReachable();

  if (!reachable) {
    spinner.fail("Cannot reach Karya server");
    console.log(chalk.red(`\n  Server not responding at ${getConfig().apiUrl}`));
    console.log(chalk.gray("  Start the server: cd F:\\karya && npm run dev"));
    console.log(chalk.gray("  Or set custom URL: KARYA_API_URL=http://host:port karya\n"));
    process.exit(1);
  }
  spinner.stop();

  // Welcome
  printWelcome(currentSessionId, getConfig().apiUrl);

  // Setup readline
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.magenta("⚡ ") + chalk.gray("> "),
    historySize: 500,
    terminal: true,
  });

  // Handle Ctrl+C: cancel running request or exit
  let lastCtrlC = 0;
  rl.on("SIGINT", () => {
    if (isProcessing && abortController) {
      // First Ctrl+C: abort the running request
      abortController.abort();
      abortController = null;
      isProcessing = false;
      console.log(chalk.yellow("\n  ⚠️  Request cancelled"));
      rl.prompt();
    } else {
      // Second Ctrl+C within 2 seconds: exit
      const now = Date.now();
      if (now - lastCtrlC < 2000) {
        console.log(chalk.gray("\n  Bye! 👋\n"));
        process.exit(0);
      }
      lastCtrlC = now;
      console.log(chalk.gray("\n  Press Ctrl+C again to exit"));
      rl.prompt();
    }
  });

  // Handle input
  rl.on("line", async (input) => {
    const line = input.trim();

    if (!line) {
      rl.prompt();
      return;
    }

    // Slash commands
    if (line.startsWith("/")) {
      await handleSlashCommand(line);
      rl.prompt();
      return;
    }

    // Regular chat message
    await handleChat(line);
    rl.prompt();
  });

  rl.on("close", () => {
    console.log(chalk.gray("\n  Bye! 👋\n"));
    process.exit(0);
  });

  rl.prompt();
}

// ============================================
// CHAT HANDLER
// ============================================

async function handleChat(message: string): Promise<void> {
  if (isProcessing) {
    console.log(chalk.yellow("  Already processing. Use /abort or Ctrl+C to cancel."));
    return;
  }

  isProcessing = true;
  abortController = new AbortController();
  resetStreamDisplay();

  // Show thinking spinner briefly
  const spinner = ora({
    text: chalk.gray("Thinking..."),
    spinner: "dots",
    indent: 2,
  }).start();

  let firstDelta = true;

  const events: StreamEvents = {
    onSession: () => {
      // Session resolved — nothing to display
    },

    onTextDelta: (delta) => {
      if (firstDelta) {
        spinner.stop();
        process.stdout.write("\n  ");
        firstDelta = false;
      }
      // Handle newlines for proper indentation
      const formatted = delta.replace(/\n/g, "\n  ");
      process.stdout.write(chalk.white(formatted));
    },

    onToolCall: (toolName) => {
      if (firstDelta) {
        spinner.stop();
        firstDelta = false;
      }
      printToolCall(toolName);
    },

    onToolResult: (toolName) => {
      printToolResult(toolName);
    },

    onDone: (info) => {
      if (firstDelta) {
        // No text or tools received at all
        spinner.stop();
      }
      printStreamDone(info);
    },

    onError: (error) => {
      spinner.stop();
      printStreamError(error);
    },
  };

  try {
    await streamChat(message, currentSessionId, events, abortController.signal);
  } catch (err: any) {
    if (err.name === "AbortError") {
      spinner.stop();
      console.log(chalk.yellow("\n  ⚠️  Request aborted"));
    } else {
      spinner.stop();
      console.log(chalk.red(`\n  ❌ ${err.message}`));
    }
  } finally {
    isProcessing = false;
    abortController = null;
  }
}

// ============================================
// SLASH COMMANDS
// ============================================

async function handleSlashCommand(input: string): Promise<void> {
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  try {
    switch (cmd) {
      case "/help":
      case "/?":
        printREPLHelp();
        break;

      case "/exit":
      case "/quit":
      case "/q":
        console.log(chalk.gray("\n  Bye! 👋\n"));
        process.exit(0);

      case "/abort":
        if (isProcessing && abortController) {
          abortController.abort();
          abortController = null;
          isProcessing = false;
          console.log(chalk.yellow("  ⚠️  Request cancelled"));
        } else {
          console.log(chalk.gray("  Nothing to abort"));
        }
        break;

      case "/sessions":
        await cmdSessions();
        break;

      case "/switch":
        await cmdSwitch(args[0]);
        break;

      case "/new":
        await cmdNew(args.join(" "));
        break;

      case "/rename":
        await cmdRename(args.join(" "));
        break;

      case "/clear":
        await cmdClear();
        break;

      case "/delete":
        await cmdDelete(args[0]);
        break;

      case "/history":
        await cmdHistory(parseInt(args[0]) || 10);
        break;

      case "/tools":
        await cmdTools(args[0]);
        break;

      case "/agents":
        await cmdAgents();
        break;

      case "/tasks":
        await cmdTasks();
        break;

      case "/workflows":
        await cmdWorkflows();
        break;

      case "/mcp":
        await cmdMCP();
        break;

      case "/memory":
        await cmdMemory(args.join(" "));
        break;

      case "/status":
        await cmdStatus();
        break;

      case "/config":
        cmdConfig();
        break;

      default:
        console.log(chalk.yellow(`  Unknown command: ${cmd}`));
        console.log(chalk.gray("  Type /help for available commands"));
    }
  } catch (err: any) {
    console.log(chalk.red(`  ❌ ${err.message}`));
  }
}

// ---- SESSION COMMANDS ----

async function cmdSessions(): Promise<void> {
  const sessions = await listSessions();
  header("💬 Sessions");
  printSessions(sessions, currentSessionId);
}

async function cmdSwitch(id?: string): Promise<void> {
  if (!id) {
    // Show sessions and ask to pick
    const sessions = await listSessions();
    header("💬 Sessions — Pick one to switch");
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const active = s.id === currentSessionId ? chalk.green(" (active)") : "";
      console.log(`  ${chalk.cyan(String(i + 1))}. ${chalk.white(s.name || "Untitled")}${active}`);
      console.log(`     ${chalk.gray(s.id)}`);
    }
    console.log(chalk.gray(`\n  Usage: /switch <session-id> or /switch <number>`));
    return;
  }

  // Allow numeric selection
  const sessions = await listSessions();
  const num = parseInt(id);
  let targetId = id;

  if (!isNaN(num) && num >= 1 && num <= sessions.length) {
    targetId = sessions[num - 1].id;
  }

  // Verify session exists
  const found = sessions.find((s: any) => s.id === targetId);
  if (!found) {
    console.log(chalk.yellow(`  Session not found: ${id}`));
    return;
  }

  currentSessionId = targetId;
  setConfig({ sessionId: targetId });
  console.log(chalk.green(`  ✓ Switched to: ${found.name || targetId}`));
}

async function cmdNew(name?: string): Promise<void> {
  const session = await createSession(name || undefined);
  currentSessionId = session.id;
  setConfig({ sessionId: session.id });
  console.log(chalk.green(`  ✓ Created session: ${session.name || session.id}`));
}

async function cmdRename(name?: string): Promise<void> {
  if (!name) {
    console.log(chalk.yellow("  Usage: /rename <new name>"));
    return;
  }
  await renameSession(currentSessionId, name);
  console.log(chalk.green(`  ✓ Renamed to: ${name}`));
}

async function cmdClear(): Promise<void> {
  await clearSession(currentSessionId);
  console.log(chalk.green("  ✓ Session cleared"));
}

async function cmdDelete(id?: string): Promise<void> {
  const target = id || currentSessionId;

  if (target === currentSessionId) {
    // Can't delete active session — switch first
    console.log(chalk.yellow("  Can't delete active session. /switch to another first, or provide a session id."));
    return;
  }

  await deleteSession(target);
  console.log(chalk.green(`  ✓ Deleted: ${target}`));
}

async function cmdHistory(count: number = 10): Promise<void> {
  const messages = await getMessages(currentSessionId, count);
  header(`📜 Last ${count} Messages — ${currentSessionId}`);
  printMessages(messages);
}

// ---- DATA COMMANDS ----

async function cmdTools(categoryOrSearch?: string): Promise<void> {
  if (categoryOrSearch) {
    // Try as category first, then as search
    try {
      const data = await listToolsByCategory(categoryOrSearch);
      header(`🔧 Tools — ${categoryOrSearch}`);
      if (data.tools?.length) {
        for (const t of data.tools) {
          console.log(`  ${chalk.gray("•")} ${chalk.white(t)}`);
        }
        console.log(chalk.gray(`\n  ${data.count || data.tools.length} tools`));
      } else {
        // Fall back to search
        const searchData = await searchTools(categoryOrSearch);
        header(`🔍 Tools matching "${categoryOrSearch}"`);
        if (searchData.tools?.length) {
          for (const t of searchData.tools) {
            console.log(`  ${chalk.gray("•")} ${chalk.white(t)}`);
          }
          console.log(chalk.gray(`\n  ${searchData.count || searchData.tools.length} results`));
        } else {
          console.log(chalk.gray("  No tools found"));
        }
      }
    } catch {
      console.log(chalk.gray("  No tools found for that query"));
    }
  } else {
    const data = await listTools();
    header("🔧 Tools");
    printTools(data);
  }
}

async function cmdAgents(): Promise<void> {
  const data = await listAgents();
  header("🤖 Agents");
  printAgents(data.agents || []);
}

async function cmdTasks(): Promise<void> {
  const data = await listTasks();
  header("📋 Scheduled Tasks");
  printTasks(data.tasks || []);
}

async function cmdWorkflows(): Promise<void> {
  const data = await listWorkflows();
  header("⚙️ Workflow Templates");
  printWorkflows(data.templates || []);
}

async function cmdMCP(): Promise<void> {
  const data = await listMCPServers();
  header("🔌 MCP Servers");
  printMCPServers(data.servers || []);
}

async function cmdMemory(query?: string): Promise<void> {
  if (!query) {
    console.log(chalk.yellow("  Usage: /memory <search query>"));
    return;
  }

  const data = await searchMemory(query);
  header(`🧠 Memory — "${query}"`);

  const results = data.results || [];
  if (results.length === 0) {
    console.log(chalk.gray("  No results found"));
    return;
  }

  for (const r of results) {
    console.log(`  ${chalk.cyan(r.file || "?")} ${chalk.gray(`(score: ${r.score || "?"})`)} `);
    if (r.snippet) {
      console.log(`    ${chalk.white(r.snippet.slice(0, 200))}`);
    }
  }
}

async function cmdStatus(): Promise<void> {
  const spinner = ora({ text: "Fetching status...", indent: 2 }).start();
  const status = await getStatus();
  spinner.stop();
  printStatus(status);
}

function cmdConfig(): void {
  const cfg = getConfig();
  header("⚙️ CLI Config");
  console.log(`  ${chalk.white("API URL:")}     ${chalk.cyan(cfg.apiUrl)}`);
  console.log(`  ${chalk.white("Token:")}       ${cfg.token ? chalk.green(cfg.token.slice(0, 10) + "***") : chalk.gray("none")}`);
  console.log(`  ${chalk.white("Session:")}     ${chalk.cyan(cfg.sessionId)}`);
  console.log(`  ${chalk.white("Active:")}      ${chalk.cyan(currentSessionId)}`);
  console.log();
  console.log(chalk.gray("  Set via environment:"));
  console.log(chalk.gray("    KARYA_API_URL=http://host:port"));
  console.log(chalk.gray("    KARYA_TOKEN=karya_xxx"));
  console.log(chalk.gray("    KARYA_SESSION=my-session"));
}
