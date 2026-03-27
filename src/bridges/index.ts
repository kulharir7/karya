/**
 * Karya Bridges — Multi-Channel Interface
 * 
 * Connect Karya to:
 * - Telegram (Bot API)
 * - WhatsApp (TODO)
 * - Discord (TODO)
 * 
 * All channels route to the same supervisor agent.
 */

export * from "./types";
export * from "./gateway";
export { TelegramBridge, createTelegramBridge } from "./telegram";
