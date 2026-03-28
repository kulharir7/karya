/**
 * Karya Bridges — Multi-Channel Interface
 * 
 * Available channels:
 * - Telegram ✅ (grammy, long polling)
 * - WhatsApp (TODO)
 * - Discord (TODO)
 * 
 * All channels route through the same ChatProcessor.
 */

export * from "./types";
export { Gateway, getGateway, initGateway } from "./gateway";
export { TelegramBridge, createTelegramBridge } from "./telegram";
