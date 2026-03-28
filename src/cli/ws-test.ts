#!/usr/bin/env tsx
/**
 * WebSocket Test Client — Quick test for Karya WS server
 * 
 * Usage:
 *   npx tsx src/cli/ws-test.ts                          # Connect and chat
 *   npx tsx src/cli/ws-test.ts "what's my system info"  # One-shot message
 *   npx tsx src/cli/ws-test.ts --token karya_xxx        # Authenticated
 * 
 * This connects to ws://localhost:3002, subscribes to default session,
 * sends a chat message, and prints the streaming response.
 */

import WebSocket from "ws";
import * as readline from "readline";

const WS_URL = process.env.KARYA_WS_URL || "ws://localhost:3002";
const SESSION_ID = process.env.KARYA_SESSION || "ws-test";

// Parse args
const args = process.argv.slice(2);
let token = "";
let oneShot = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--token" && args[i + 1]) {
    token = args[i + 1];
    i++;
  } else if (!args[i].startsWith("--")) {
    oneShot = args[i];
  }
}

const url = token ? `${WS_URL}?token=${token}` : WS_URL;

console.log(`\n⚡ Karya WS Test Client`);
console.log(`   Connecting to: ${WS_URL}`);
console.log(`   Session: ${SESSION_ID}\n`);

const ws = new WebSocket(url);
let connected = false;

ws.on("open", () => {
  connected = true;
  console.log("✓ Connected!\n");

  // Subscribe to session
  ws.send(JSON.stringify({ type: "subscribe", sessionId: SESSION_ID }));
});

ws.on("message", (raw) => {
  try {
    const msg = JSON.parse(raw.toString());
    const { type, data } = msg;

    switch (type) {
      case "session":
        if (data?.event === "connected") {
          console.log(`  Client ID: ${data.clientId}`);
        } else if (data?.event === "subscribed") {
          console.log(`  Subscribed to: ${data.sessionId}`);
          if (oneShot) {
            sendChat(oneShot);
          } else {
            startREPL();
          }
        } else if (data?.event === "agent_start") {
          process.stdout.write("\n🤖 ");
        } else if (data?.event === "aborted") {
          console.log("\n⚠️  Request aborted");
        } else {
          console.log(`  [session] ${JSON.stringify(data)}`);
        }
        break;

      case "text-delta":
        process.stdout.write(data?.delta || "");
        break;

      case "tool-call":
        console.log(`\n  🔧 ${data?.toolName || "unknown"}`);
        break;

      case "tool-result":
        // Don't print full result (can be huge)
        console.log(`  ✅ ${data?.toolName || "tool"} done`);
        break;

      case "done":
        if (data?.durationMs) {
          console.log(`\n  ⏱️  ${data.durationMs}ms | Tools: ${data.toolCount || 0}`);
        }
        console.log();
        if (oneShot) {
          ws.close();
          process.exit(0);
        }
        break;

      case "error":
        console.log(`\n  ❌ ${data?.message || "Unknown error"}`);
        break;

      case "pong":
        // Silent
        break;

      default:
        console.log(`  [${type}] ${JSON.stringify(data)}`);
    }
  } catch {
    console.log(`  [raw] ${raw.toString()}`);
  }
});

ws.on("close", (code, reason) => {
  console.log(`\n  Disconnected (${code}${reason ? ": " + reason : ""})`);
  process.exit(0);
});

ws.on("error", (err) => {
  console.error(`\n  ❌ Connection error: ${err.message}`);
  console.log("  Is the Karya server running? Try: npm run dev");
  process.exit(1);
});

function sendChat(message: string) {
  ws.send(
    JSON.stringify({
      type: "chat",
      sessionId: SESSION_ID,
      data: { message },
    })
  );
}

function startREPL() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\n> ",
  });

  rl.prompt();

  rl.on("line", (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input === "/quit" || input === "/exit") {
      ws.close();
      rl.close();
      return;
    }

    if (input === "/abort") {
      ws.send(JSON.stringify({ type: "abort" }));
      rl.prompt();
      return;
    }

    if (input === "/sessions") {
      ws.send(JSON.stringify({ type: "sessions-list" }));
      rl.prompt();
      return;
    }

    if (input === "/tools") {
      ws.send(JSON.stringify({ type: "tools-list" }));
      rl.prompt();
      return;
    }

    if (input === "/status") {
      ws.send(JSON.stringify({ type: "status" }));
      rl.prompt();
      return;
    }

    if (input === "/ping") {
      ws.send(JSON.stringify({ type: "ping" }));
      rl.prompt();
      return;
    }

    sendChat(input);
  });

  rl.on("close", () => {
    ws.close();
  });
}

// Periodic ping
setInterval(() => {
  if (connected && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "ping" }));
  }
}, 25000);
