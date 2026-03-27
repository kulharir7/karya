/**
 * Karya Telegram Bridge
 * 
 * Connect Karya to Telegram using Bot API
 * Users can chat with their AI agent via Telegram
 */

import type { ChannelBridge, IncomingMessage, OutgoingMessage } from "./types";
import { eventBus } from "../lib/event-bus";
import { logger } from "../lib/logger";

// Note: Install grammy: npm install grammy
// This is a template — actual implementation needs grammy

export class TelegramBridge implements ChannelBridge {
  type: "telegram" = "telegram";
  private bot: any = null;
  private token: string;
  private allowedUsers: string[];
  private running = false;

  constructor(config: { botToken: string; allowedUsers?: string[] }) {
    this.token = config.botToken;
    this.allowedUsers = config.allowedUsers || [];
  }

  async init(): Promise<void> {
    if (this.running) return;

    try {
      // Dynamic import to avoid bundling issues
      const { Bot } = await import("grammy");
      
      this.bot = new Bot(this.token);

      // Handle messages
      this.bot.on("message:text", async (ctx: any) => {
        const userId = ctx.from.id.toString();
        const chatId = ctx.chat.id.toString();
        const text = ctx.message.text;

        // Check if user is allowed
        if (this.allowedUsers.length > 0 && !this.allowedUsers.includes(userId)) {
          await ctx.reply("Sorry, you're not authorized to use this bot.");
          return;
        }

        logger.info("telegram", `Message from ${userId}: ${text.slice(0, 50)}...`);

        // Emit message event
        const message: IncomingMessage = {
          channel: "telegram",
          userId,
          chatId,
          text,
          timestamp: Date.now(),
          metadata: {
            firstName: ctx.from.first_name,
            username: ctx.from.username,
            messageId: ctx.message.message_id,
          },
        };

        eventBus.emit("bridge:message", message);

        // Typing indicator while processing
        await ctx.api.sendChatAction(chatId, "typing");
      });

      // Handle photos
      this.bot.on("message:photo", async (ctx: any) => {
        const userId = ctx.from.id.toString();
        const chatId = ctx.chat.id.toString();
        const caption = ctx.message.caption || "";

        // Get largest photo
        const photos = ctx.message.photo;
        const largest = photos[photos.length - 1];
        const file = await ctx.api.getFile(largest.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.token}/${file.file_path}`;

        // Download image
        const response = await fetch(fileUrl);
        const buffer = Buffer.from(await response.arrayBuffer());

        const message: IncomingMessage = {
          channel: "telegram",
          userId,
          chatId,
          text: caption,
          images: [buffer],
          timestamp: Date.now(),
        };

        eventBus.emit("bridge:message", message);
      });

      // Start bot
      await this.bot.start();
      this.running = true;
      logger.info("telegram", "Telegram bot started");

    } catch (err: any) {
      if (err.message?.includes("Cannot find module")) {
        logger.warn("telegram", "grammy not installed. Run: npm install grammy");
      } else {
        logger.error("telegram", "Failed to start Telegram bot", err);
      }
      throw err;
    }
  }

  async send(message: OutgoingMessage): Promise<void> {
    if (!this.bot || !this.running) {
      logger.warn("telegram", "Bot not running, cannot send message");
      return;
    }

    try {
      const options: any = {};
      
      if (message.replyTo) {
        options.reply_to_message_id = parseInt(message.replyTo);
      }
      
      if (message.markdown) {
        options.parse_mode = "Markdown";
      }

      await this.bot.api.sendMessage(message.chatId, message.text, options);
      
    } catch (err) {
      logger.error("telegram", "Failed to send message", err);
    }
  }

  async stop(): Promise<void> {
    if (this.bot && this.running) {
      await this.bot.stop();
      this.running = false;
      logger.info("telegram", "Telegram bot stopped");
    }
  }

  isRunning(): boolean {
    return this.running;
  }
}

/**
 * Create Telegram bridge from environment
 */
export function createTelegramBridge(): TelegramBridge | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    logger.info("telegram", "TELEGRAM_BOT_TOKEN not set, skipping Telegram bridge");
    return null;
  }

  const allowedUsers = process.env.TELEGRAM_ALLOWED_USERS?.split(",").map(s => s.trim()) || [];
  
  return new TelegramBridge({ botToken: token, allowedUsers });
}
