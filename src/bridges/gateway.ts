/**
 * Karya Gateway — Unified Message Router
 * 
 * Routes messages from any channel (Telegram, WhatsApp, Discord, Web)
 * to the same supervisor agent.
 * 
 * Same agent, multiple input channels.
 */

import type { ChannelBridge, IncomingMessage, OutgoingMessage, ChannelType, GatewayConfig } from "./types";
import { eventBus } from "../lib/event-bus";
import { logger } from "../lib/logger";
import { createTelegramBridge } from "./telegram";

export class Gateway {
  private bridges: Map<ChannelType, ChannelBridge> = new Map();
  private messageHandler: ((msg: IncomingMessage) => Promise<string>) | null = null;
  private running = false;

  constructor() {
    // Listen for messages from bridges
    eventBus.on("bridge:message", this.handleMessage.bind(this));
  }

  /**
   * Set the message handler (agent)
   */
  setMessageHandler(handler: (msg: IncomingMessage) => Promise<string>): void {
    this.messageHandler = handler;
  }

  /**
   * Initialize all configured bridges
   */
  async init(config?: GatewayConfig): Promise<void> {
    // Telegram
    const telegramBridge = createTelegramBridge();
    if (telegramBridge) {
      try {
        await telegramBridge.init();
        this.bridges.set("telegram", telegramBridge);
      } catch (err) {
        logger.warn("gateway", "Telegram bridge failed to init");
      }
    }

    // WhatsApp (TODO: implement)
    // const whatsappBridge = createWhatsAppBridge();
    // if (whatsappBridge) { ... }

    // Discord (TODO: implement)
    // const discordBridge = createDiscordBridge();
    // if (discordBridge) { ... }

    this.running = true;
    logger.info("gateway", `Started with ${this.bridges.size} bridges`);
  }

  /**
   * Handle incoming message from any channel
   */
  private async handleMessage(msg: IncomingMessage): Promise<void> {
    if (!this.messageHandler) {
      logger.warn("gateway", "No message handler set, ignoring message");
      return;
    }

    logger.info("gateway", `Message from ${msg.channel}/${msg.userId}: ${msg.text.slice(0, 50)}...`);

    try {
      // Process message through agent
      const response = await this.messageHandler(msg);

      // Send response back through same channel
      if (response && response.trim()) {
        await this.send({
          channel: msg.channel,
          chatId: msg.chatId,
          text: response,
          replyTo: msg.metadata?.messageId,
          markdown: true,
        });
      }
    } catch (err) {
      logger.error("gateway", "Failed to process message", err);
      
      // Send error response
      await this.send({
        channel: msg.channel,
        chatId: msg.chatId,
        text: "Sorry, something went wrong. Please try again.",
      });
    }
  }

  /**
   * Send message through a channel
   */
  async send(message: OutgoingMessage): Promise<void> {
    const bridge = this.bridges.get(message.channel);
    
    if (!bridge) {
      logger.warn("gateway", `No bridge for channel: ${message.channel}`);
      return;
    }

    await bridge.send(message);
  }

  /**
   * Broadcast to all channels for a user
   */
  async broadcast(userId: string, text: string): Promise<void> {
    // TODO: Implement user-channel mapping
    // For now, just log
    logger.info("gateway", `Broadcast to ${userId}: ${text.slice(0, 50)}...`);
  }

  /**
   * Stop all bridges
   */
  async stop(): Promise<void> {
    for (const [type, bridge] of this.bridges) {
      try {
        await bridge.stop();
        logger.info("gateway", `Stopped ${type} bridge`);
      } catch (err) {
        logger.error("gateway", `Failed to stop ${type} bridge`, err);
      }
    }
    
    this.bridges.clear();
    this.running = false;
  }

  /**
   * Get bridge status
   */
  getStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    
    for (const [type, bridge] of this.bridges) {
      status[type] = bridge.isRunning();
    }
    
    return status;
  }
}

// Singleton instance
let gatewayInstance: Gateway | null = null;

export function getGateway(): Gateway {
  if (!gatewayInstance) {
    gatewayInstance = new Gateway();
  }
  return gatewayInstance;
}

/**
 * Initialize gateway with agent handler
 */
export async function initGateway(
  handler: (msg: IncomingMessage) => Promise<string>,
  config?: GatewayConfig
): Promise<Gateway> {
  const gateway = getGateway();
  gateway.setMessageHandler(handler);
  await gateway.init(config);
  return gateway;
}
