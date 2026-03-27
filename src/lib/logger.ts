/**
 * Karya Logger
 * Proper logging with levels, context, and event bus integration
 */

import { eventBus } from "./event-bus";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  extra?: unknown;
}

// Color codes for terminal
const COLORS = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m",  // green
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
  reset: "\x1b[0m",
};

function formatLog(level: LogLevel, context: string, message: string): string {
  const timestamp = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const color = COLORS[level];
  const reset = COLORS.reset;
  return `${color}[${timestamp}] [${context}] [${level.toUpperCase()}]${reset} ${message}`;
}

function log(level: LogLevel, context: string, message: string, extra?: unknown): void {
  const formatted = formatLog(level, context, message);
  
  switch (level) {
    case "error":
      console.error(formatted, extra !== undefined ? extra : "");
      // Emit to event bus for UI/audit
      eventBus.emit("log:error", { context, message, extra, timestamp: Date.now() });
      break;
    case "warn":
      console.warn(formatted, extra !== undefined ? extra : "");
      break;
    case "info":
      console.log(formatted);
      break;
    case "debug":
      // Only in development
      if (process.env.NODE_ENV === "development" || process.env.DEBUG) {
        console.log(formatted, extra !== undefined ? extra : "");
      }
      break;
  }
}

export const logger = {
  debug: (ctx: string, msg: string, extra?: unknown) => log("debug", ctx, msg, extra),
  info: (ctx: string, msg: string) => log("info", ctx, msg),
  warn: (ctx: string, msg: string, extra?: unknown) => log("warn", ctx, msg, extra),
  error: (ctx: string, msg: string, extra?: unknown) => log("error", ctx, msg, extra),
  
  // Convenience method for tool execution
  tool: (toolName: string, action: "start" | "success" | "error", details?: string) => {
    const level = action === "error" ? "error" : "debug";
    log(level, `tool:${toolName}`, `${action}${details ? `: ${details}` : ""}`);
  },
};

export default logger;
