/**
 * Karya Bridge Gateway — Unified channel manager
 * 
 * Manages all external channel bridges (Telegram, WhatsApp, Discord).
 * Each bridge routes messages through ChatProcessor.
 * 
 * Usage:
 *   const gw = getGateway();
 *   await gw.startBridge("telegram");  // Start Telegram bridge
 *   gw.getStatus();                     // Get all bridge statuses
 *   await gw.stopAll();                 // Stop everything
 */

import type { ChannelBridge, ChannelType, BridgeConfig, BridgeInfo } from "./types";
import { eventBus } from "../lib/event-bus";
import { logger } from "../lib/logger";
import { createTelegramBridge, TelegramBridge } from "./telegram";

// ============================================
// GATEWAY CLASS
// ============================================

export class Gateway {
  private bridges: Map<ChannelType, ChannelBridge> = new Map();
  private running = false;

  /**
   * Start a specific bridge by type.
   */
  async startBridge(type: ChannelType): Promise<BridgeInfo> {
    // Check if already running
    const existing = this.bridges.get(type);
    if (existing?.isRunning()) {
      return existing.getInfo();
    }

    let bridge: ChannelBridge | null = null;

    switch (type) {
      case "telegram":
        bridge = createTelegramBridge();
        break;

      // Future channels:
      // case "whatsapp":
      //   bridge = createWhatsAppBridge();
      //   break;
      // case "discord":
      //   bridge = createDiscordBridge();
      //   break;

      default:
        throw new Error(`Unknown bridge type: ${type}`);
    }

    if (!bridge) {
      throw new Error(`Failed to create ${type} bridge. Check configuration/env vars.`);
    }

    await bridge.init();
    this.bridges.set(type, bridge);
    this.running = true;

    logger.info("gateway", `Bridge started: ${type}`);
    return bridge.getInfo();
  }

  /**
   * Stop a specific bridge.
   */
  async stopBridge(type: ChannelType): Promise<void> {
    const bridge = this.bridges.get(type);
    if (!bridge) {
      logger.warn("gateway", `No bridge found for: ${type}`);
      return;
    }

    await bridge.stop();
    this.bridges.delete(type);

    if (this.bridges.size === 0) {
      this.running = false;
    }

    logger.info("gateway", `Bridge stopped: ${type}`);
  }

  /**
   * Initialize all configured bridges from env vars.
   */
  async initAll(): Promise<void> {
    // Telegram
    if (process.env.TELEGRAM_BOT_TOKEN) {
      try {
        await this.startBridge("telegram");
      } catch (err: any) {
        logger.warn("gateway", `Telegram bridge failed: ${err.message}`);
      }
    }

    // Future: WhatsApp, Discord, etc.

    logger.info("gateway", `Gateway initialized with ${this.bridges.size} bridges`);
  }

  /**
   * Stop all bridges.
   */
  async stopAll(): Promise<void> {
    for (const [type, bridge] of this.bridges) {
      try {
        await bridge.stop();
        logger.info("gateway", `Stopped: ${type}`);
      } catch (err: any) {
        logger.error("gateway", `Failed to stop ${type}: ${err.message}`);
      }
    }

    this.bridges.clear();
    this.running = false;
  }

  /**
   * Get status of all bridges.
   */
  getStatus(): BridgeInfo[] {
    const statuses: BridgeInfo[] = [];
    for (const bridge of this.bridges.values()) {
      statuses.push(bridge.getInfo());
    }
    return statuses;
  }

  /**
   * Get a specific bridge.
   */
  getBridge(type: ChannelType): ChannelBridge | null {
    return this.bridges.get(type) || null;
  }

  /**
   * Is any bridge running?
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * List available bridge types (including unconfigured ones).
   */
  getAvailableBridges(): Array<{ type: ChannelType; configured: boolean; running: boolean }> {
    return [
      {
        type: "telegram",
        configured: !!process.env.TELEGRAM_BOT_TOKEN,
        running: this.bridges.get("telegram")?.isRunning() || false,
      },
      {
        type: "whatsapp",
        configured: false, // TODO
        running: false,
      },
      {
        type: "discord",
        configured: false, // TODO
        running: false,
      },
    ];
  }
}

// ============================================
// SINGLETON
// ============================================

let gatewayInstance: Gateway | null = null;

export function getGateway(): Gateway {
  if (!gatewayInstance) {
    gatewayInstance = new Gateway();
  }
  return gatewayInstance;
}

/**
 * Quick init: start all configured bridges.
 */
export async function initGateway(): Promise<Gateway> {
  const gateway = getGateway();
  await gateway.initAll();
  return gateway;
}
