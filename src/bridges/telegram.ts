/**
 * Karya Telegram Bridge — Full implementation with grammy
 * 
 * Features:
 * - Long polling (no webhook needed — works locally)
 * - Chat processing via ChatProcessor (same engine as web/CLI/WS)
 * - Per-user sessions (tg-{userId})
 * - Typing indicator while agent thinks
 * - Photo/image support (vision)
 * - Markdown formatting for responses
 * - Allowed users whitelist (security)
 * - Bot commands: /start, /help, /status, /new, /tools
 * - Long message splitting (Telegram 4096 char limit)
 * - Error recovery (auto-retry on network errors)
 * 
 * Setup:
 * 1. Create bot via @BotFather on Telegram
 * 2. Set TELEGRAM_BOT_TOKEN env var (or pass in config)
 * 3. Optional: TELEGRAM_ALLOWED_USERS=comma,separated,ids
 */

import { Bot, Context, InputFile } from "grammy";
import type { ChannelBridge, IncomingMessage, OutgoingMessage, BridgeInfo } from "./types";
import { processChat, processChatSync, type ChatRequest } from "../lib/chat-processor";
import { eventBus } from "../lib/event-bus";
import { logger } from "../lib/logger";

// ============================================
// CONSTANTS
// ============================================

/** Telegram message character limit */
const MAX_MESSAGE_LENGTH = 4096;

/** Typing indicator refresh interval (Telegram expires after 5s) */
const TYPING_INTERVAL_MS = 4000;

// ============================================
// TELEGRAM BRIDGE CLASS
// ============================================

export class TelegramBridge implements ChannelBridge {
  type: "telegram" = "telegram";

  private bot: Bot;
  private token: string;
  private allowedUsers: Set<string>;
  private sessionPrefix: string;
  private running = false;
  private startedAt: number | null = null;
  private botUsername: string = "";
  private activeChats = new Set<string>();
  private typingIntervals = new Map<string, NodeJS.Timeout>();
  private lastError: string | null = null;

  constructor(config: {
    botToken: string;
    allowedUsers?: string[];
    sessionPrefix?: string;
  }) {
    this.token = config.botToken;
    this.allowedUsers = new Set(config.allowedUsers || []);
    this.sessionPrefix = config.sessionPrefix || "tg-";
    this.bot = new Bot(this.token);
  }

  // ---- LIFECYCLE ----

  async init(): Promise<void> {
    if (this.running) return;

    try {
      // Get bot info
      const me = await this.bot.api.getMe();
      this.botUsername = me.username || me.first_name;
      logger.info("telegram", `Bot identity: @${this.botUsername}`);

      // Register handlers
      this.registerCommands();
      this.registerMessageHandlers();

      // Set bot commands menu (shows in Telegram UI)
      await this.bot.api.setMyCommands([
        { command: "start", description: "Start chatting with Karya" },
        { command: "help", description: "Show available commands" },
        { command: "status", description: "Check Karya server status" },
        { command: "new", description: "Start a new chat session" },
        { command: "tools", description: "List available tools" },
        { command: "clear", description: "Clear current session" },
      ]);

      // Start long polling
      this.bot.start({
        onStart: () => {
          this.running = true;
          this.startedAt = Date.now();
          this.lastError = null;
          logger.info("telegram", `@${this.botUsername} started (long polling)`);
          eventBus.emit("bridge:message", {
            channel: "telegram",
            userId: "system",
            chatId: "system",
            text: `Telegram bridge started: @${this.botUsername}`,
            timestamp: Date.now(),
          });
        },
      });

      // Error handler
      this.bot.catch((err) => {
        this.lastError = err.message || "Unknown error";
        logger.error("telegram", `Bot error: ${this.lastError}`);
      });

      this.running = true;
      this.startedAt = Date.now();
    } catch (err: any) {
      this.lastError = err.message;
      logger.error("telegram", `Failed to start: ${err.message}`);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    // Clear all typing intervals
    for (const [, interval] of this.typingIntervals) {
      clearInterval(interval);
    }
    this.typingIntervals.clear();

    await this.bot.stop();
    this.running = false;
    this.startedAt = null;
    logger.info("telegram", "Bot stopped");
  }

  isRunning(): boolean {
    return this.running;
  }

  getInfo(): BridgeInfo {
    return {
      type: "telegram",
      running: this.running,
      identity: this.botUsername ? `@${this.botUsername}` : undefined,
      activeChats: this.activeChats.size,
      startedAt: this.startedAt,
      error: this.lastError || undefined,
    };
  }

  // ---- COMMAND HANDLERS ----

  private registerCommands(): void {
    // /start — Welcome message
    this.bot.command("start", async (ctx) => {
      if (!this.checkAuth(ctx)) return;

      const name = ctx.from?.first_name || "there";
      await ctx.reply(
        `👋 Hey ${name}! I'm *Karya* — your AI Computer Agent.\n\n` +
        `I can do real things on your computer: browse the web, manage files, ` +
        `write code, analyze data, and much more.\n\n` +
        `Just send me a message and I'll get to work!\n\n` +
        `Type /help to see all commands.`,
        { parse_mode: "Markdown" }
      );
    });

    // /help — Commands list
    this.bot.command("help", async (ctx) => {
      if (!this.checkAuth(ctx)) return;

      await ctx.reply(
        `⚡ *Karya Commands*\n\n` +
        `/start — Welcome message\n` +
        `/help — This help text\n` +
        `/status — Server status\n` +
        `/new — Start a new chat session\n` +
        `/tools — List available tools\n` +
        `/clear — Clear current session\n\n` +
        `Or just send any message to chat!`,
        { parse_mode: "Markdown" }
      );
    });

    // /status — Server status
    this.bot.command("status", async (ctx) => {
      if (!this.checkAuth(ctx)) return;

      const sessionId = this.getSessionId(ctx);
      await ctx.reply(
        `📊 *Karya Status*\n\n` +
        `🤖 Bot: @${this.botUsername}\n` +
        `💬 Your session: \`${sessionId}\`\n` +
        `📡 Bridge: running\n` +
        `👥 Active chats: ${this.activeChats.size}\n` +
        `⏱️ Uptime: ${this.formatUptime()}`,
        { parse_mode: "Markdown" }
      );
    });

    // /new — New session
    this.bot.command("new", async (ctx) => {
      if (!this.checkAuth(ctx)) return;

      const oldId = this.getSessionId(ctx);
      // Generate new session suffix
      const newSuffix = Date.now().toString(36);
      const chatId = ctx.chat?.id.toString() || "0";
      // Store new session mapping (in memory for now)
      sessionOverrides.set(chatId, `${this.sessionPrefix}${chatId}-${newSuffix}`);

      const newId = this.getSessionId(ctx);
      await ctx.reply(
        `✅ New session started!\n\n` +
        `Old: \`${oldId}\`\n` +
        `New: \`${newId}\``,
        { parse_mode: "Markdown" }
      );
    });

    // /tools — List tools
    this.bot.command("tools", async (ctx) => {
      if (!this.checkAuth(ctx)) return;

      try {
        const { getToolsByCategory } = await import("../lib/chat-processor");
        const categories = getToolsByCategory();
        let text = "🔧 *Available Tools*\n\n";

        for (const [cat, tools] of Object.entries(categories)) {
          if (tools.length === 0) continue;
          text += `*${cat.toUpperCase()}* (${tools.length})\n`;
          text += tools.map((t) => `  • \`${t}\``).join("\n") + "\n\n";
        }

        // Split if too long
        await this.sendLongMessage(ctx, text, "Markdown");
      } catch (err: any) {
        await ctx.reply(`❌ Error: ${err.message}`);
      }
    });

    // /clear — Clear session
    this.bot.command("clear", async (ctx) => {
      if (!this.checkAuth(ctx)) return;

      try {
        const sessionId = this.getSessionId(ctx);
        const { clearMessages } = await import("../lib/session-manager");
        await clearMessages(sessionId);
        await ctx.reply("✅ Session cleared! Fresh start.");
      } catch (err: any) {
        await ctx.reply(`❌ Error: ${err.message}`);
      }
    });
  }

  // ---- MESSAGE HANDLERS ----

  private registerMessageHandlers(): void {
    // Text messages
    this.bot.on("message:text", async (ctx) => {
      // Skip commands (already handled)
      if (ctx.message.text.startsWith("/")) return;
      if (!this.checkAuth(ctx)) return;

      await this.handleTextMessage(ctx, ctx.message.text);
    });

    // Photo messages (vision)
    this.bot.on("message:photo", async (ctx) => {
      if (!this.checkAuth(ctx)) return;

      const caption = ctx.message.caption || "Describe this image";
      const photos = ctx.message.photo;
      const largest = photos[photos.length - 1];

      try {
        // Download photo
        const file = await ctx.api.getFile(largest.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.token}/${file.file_path}`;
        const response = await fetch(fileUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        const base64 = buffer.toString("base64");

        // Determine mime type from file path
        const ext = file.file_path?.split(".").pop()?.toLowerCase() || "jpg";
        const mimeMap: Record<string, string> = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
        };
        const mimeType = mimeMap[ext] || "image/jpeg";

        await this.handleTextMessage(ctx, caption, [{ base64, mimeType }]);
      } catch (err: any) {
        logger.error("telegram", `Photo processing error: ${err.message}`);
        await ctx.reply(`❌ Failed to process image: ${err.message}`);
      }
    });

    // Document messages (file upload)
    this.bot.on("message:document", async (ctx) => {
      if (!this.checkAuth(ctx)) return;

      const doc = ctx.message.document;
      const caption = ctx.message.caption || `Uploaded file: ${doc.file_name || "document"}`;

      // For now, just process the caption/filename
      // Full file handling would need download + save
      await this.handleTextMessage(ctx, caption);
    });

    // Voice messages
    this.bot.on("message:voice", async (ctx) => {
      if (!this.checkAuth(ctx)) return;
      await ctx.reply("🎤 Voice messages are not supported yet. Please type your message.");
    });
  }

  // ---- CORE: Process message through ChatProcessor ----

  private async handleTextMessage(
    ctx: Context,
    text: string,
    images?: Array<{ base64: string; mimeType: string }>
  ): Promise<void> {
    const chatId = ctx.chat?.id.toString() || "0";
    const userId = ctx.from?.id.toString() || "0";
    const sessionId = this.getSessionId(ctx);

    this.activeChats.add(chatId);
    logger.info("telegram", `[${userId}] ${text.slice(0, 80)}${text.length > 80 ? "..." : ""}`);

    // Start typing indicator (refreshes every 4s)
    this.startTyping(chatId);

    try {
      const chatReq: ChatRequest = {
        message: text,
        sessionId,
        images,
        channel: "telegram",
      };

      // Use sync processor (collect full response, then send)
      // Telegram doesn't support real-time streaming — message editing is janky
      const result = await processChatSync(chatReq);

      // Stop typing
      this.stopTyping(chatId);

      // Build response text
      let responseText = result.text || "✅ Done.";

      // Append tool summary if tools were used
      if (result.toolCalls.length > 0) {
        const toolNames = result.toolCalls.map((t) => t.toolName);
        const uniqueTools = [...new Set(toolNames)];
        const toolLine = uniqueTools.map((t) => `\`${t}\``).join(", ");
        responseText += `\n\n🔧 _Tools: ${toolLine}_`;
      }

      // Append timing
      if (result.durationMs > 0) {
        responseText += `\n⏱️ _${(result.durationMs / 1000).toFixed(1)}s_`;
      }

      // Send response (split if too long)
      await this.sendLongMessage(ctx, responseText, "Markdown");

    } catch (err: any) {
      this.stopTyping(chatId);
      logger.error("telegram", `Chat error: ${err.message}`);
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  }

  // ---- AUTH ----

  private checkAuth(ctx: Context): boolean {
    // No whitelist = allow everyone
    if (this.allowedUsers.size === 0) return true;

    const userId = ctx.from?.id.toString();
    if (!userId || !this.allowedUsers.has(userId)) {
      ctx.reply("🚫 You're not authorized to use this bot.\n\nAsk the bot owner to add your user ID.");
      logger.warn("telegram", `Unauthorized user: ${userId} (@${ctx.from?.username})`);
      return false;
    }
    return true;
  }

  // ---- SESSION MANAGEMENT ----

  private getSessionId(ctx: Context): string {
    const chatId = ctx.chat?.id.toString() || "0";

    // Check for override (from /new command)
    if (sessionOverrides.has(chatId)) {
      return sessionOverrides.get(chatId)!;
    }

    // Default: tg-{chatId} (each Telegram chat = one session)
    return `${this.sessionPrefix}${chatId}`;
  }

  // ---- TYPING INDICATOR ----

  private startTyping(chatId: string): void {
    // Send immediately
    this.bot.api.sendChatAction(chatId, "typing").catch(() => {});

    // Refresh every 4 seconds (Telegram expires typing after 5s)
    const interval = setInterval(() => {
      this.bot.api.sendChatAction(chatId, "typing").catch(() => {});
    }, TYPING_INTERVAL_MS);

    // Store so we can clear later
    this.typingIntervals.set(chatId, interval);
  }

  private stopTyping(chatId: string): void {
    const interval = this.typingIntervals.get(chatId);
    if (interval) {
      clearInterval(interval);
      this.typingIntervals.delete(chatId);
    }
  }

  // ---- MESSAGE SPLITTING ----

  private async sendLongMessage(
    ctx: Context,
    text: string,
    parseMode?: "Markdown" | "HTML"
  ): Promise<void> {
    // Clean markdown that Telegram can't handle
    let cleanText = text;
    if (parseMode === "Markdown") {
      cleanText = this.sanitizeTelegramMarkdown(text);
    }

    if (cleanText.length <= MAX_MESSAGE_LENGTH) {
      try {
        await ctx.reply(cleanText, parseMode ? { parse_mode: parseMode } : {});
      } catch {
        // If Markdown fails, send as plain text
        await ctx.reply(this.stripMarkdown(cleanText));
      }
      return;
    }

    // Split into chunks at paragraph or line boundaries
    const chunks = this.splitMessage(cleanText, MAX_MESSAGE_LENGTH);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length}) ` : "";
      try {
        await ctx.reply(prefix + chunk, parseMode ? { parse_mode: parseMode } : {});
      } catch {
        await ctx.reply(prefix + this.stripMarkdown(chunk));
      }

      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  private splitMessage(text: string, maxLen: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > maxLen) {
      // Find a good split point: double newline > single newline > space > hard cut
      let splitAt = remaining.lastIndexOf("\n\n", maxLen);
      if (splitAt < maxLen * 0.5) {
        splitAt = remaining.lastIndexOf("\n", maxLen);
      }
      if (splitAt < maxLen * 0.5) {
        splitAt = remaining.lastIndexOf(" ", maxLen);
      }
      if (splitAt < maxLen * 0.3) {
        splitAt = maxLen;
      }

      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }

    if (remaining) {
      chunks.push(remaining);
    }

    return chunks;
  }

  /** Remove Markdown syntax that Telegram MarkdownV1 can't handle */
  private sanitizeTelegramMarkdown(text: string): string {
    // Telegram MarkdownV1 supports: *bold*, _italic_, `code`, ```pre```, [link](url)
    // Remove things that break: unmatched *, _, etc.
    // Replace tables with plain text (Telegram doesn't support tables)
    let clean = text;

    // Remove markdown tables (| --- | format)
    clean = clean.replace(/\|[^\n]+\|/g, (match) => {
      // Convert table row to bullet list
      return match
        .split("|")
        .filter((cell) => cell.trim() && !cell.match(/^[\s-]+$/))
        .map((cell) => `• ${cell.trim()}`)
        .join("\n");
    });

    // Remove horizontal rules
    clean = clean.replace(/^---+$/gm, "");

    // Headers: ## Title → *Title*
    clean = clean.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");

    return clean;
  }

  /** Strip all Markdown for fallback plain text */
  private stripMarkdown(text: string): string {
    return text
      .replace(/[*_`]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  }

  // ---- OUTGOING MESSAGE (for Gateway compatibility) ----

  async send(message: OutgoingMessage): Promise<void> {
    if (!this.running) {
      logger.warn("telegram", "Bot not running, cannot send");
      return;
    }

    try {
      const options: any = {};
      if (message.replyTo) {
        options.reply_parameters = { message_id: parseInt(message.replyTo) };
      }
      if (message.markdown) {
        options.parse_mode = "Markdown";
      }

      const text = message.text;
      if (text.length <= MAX_MESSAGE_LENGTH) {
        await this.bot.api.sendMessage(message.chatId, text, options);
      } else {
        // Split and send
        const chunks = this.splitMessage(text, MAX_MESSAGE_LENGTH);
        for (const chunk of chunks) {
          await this.bot.api.sendMessage(message.chatId, chunk, options);
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    } catch (err: any) {
      logger.error("telegram", `Send error: ${err.message}`);
    }
  }

  // ---- UTILITIES ----

  private formatUptime(): string {
    if (!this.startedAt) return "not started";
    const ms = Date.now() - this.startedAt;
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000) % 60;
    const h = Math.floor(ms / 3600000);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }
}

// ============================================
// SESSION OVERRIDES (for /new command)
// ============================================

const sessionOverrides = new Map<string, string>();

// ============================================
// FACTORY
// ============================================

/**
 * Create Telegram bridge from environment variables.
 * Returns null if TELEGRAM_BOT_TOKEN is not set.
 */
export function createTelegramBridge(): TelegramBridge | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    logger.info("telegram", "TELEGRAM_BOT_TOKEN not set, skipping");
    return null;
  }

  const allowedUsers = process.env.TELEGRAM_ALLOWED_USERS
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) || [];

  const sessionPrefix = process.env.TELEGRAM_SESSION_PREFIX || "tg-";

  return new TelegramBridge({
    botToken: token,
    allowedUsers,
    sessionPrefix,
  });
}
