/**
 * Karya Bridges — Type Definitions
 * 
 * Shared types for all channel bridges (Telegram, WhatsApp, Discord, etc.)
 * Every bridge implements ChannelBridge interface.
 */

export type ChannelType = "web" | "telegram" | "whatsapp" | "discord";

/** Message coming IN from an external channel */
export interface IncomingMessage {
  channel: ChannelType;
  /** Unique user identifier on that platform */
  userId: string;
  /** Chat/group ID (for sending replies back) */
  chatId: string;
  /** The text message */
  text: string;
  /** Optional image buffers (for vision) */
  images?: Buffer[];
  /** Message being replied to */
  replyTo?: string;
  /** When the message was sent */
  timestamp: number;
  /** Platform-specific metadata */
  metadata?: Record<string, any>;
}

/** Message going OUT to an external channel */
export interface OutgoingMessage {
  channel: ChannelType;
  chatId: string;
  text: string;
  replyTo?: string;
  /** Send as Markdown (MarkdownV2 for Telegram) */
  markdown?: boolean;
  /** Inline keyboard buttons */
  buttons?: Array<{ text: string; callback: string }>;
}

/** Every channel bridge must implement this */
export interface ChannelBridge {
  type: ChannelType;
  /** Initialize and connect to the platform */
  init(): Promise<void>;
  /** Send a message through this channel */
  send(message: OutgoingMessage): Promise<void>;
  /** Stop the bridge gracefully */
  stop(): Promise<void>;
  /** Is the bridge currently connected and running? */
  isRunning(): boolean;
  /** Get bridge status info */
  getInfo(): BridgeInfo;
}

/** Status info for a bridge */
export interface BridgeInfo {
  type: ChannelType;
  running: boolean;
  /** Bot username (Telegram), phone number (WhatsApp), etc. */
  identity?: string;
  /** Number of active chats */
  activeChats: number;
  /** When the bridge was started */
  startedAt: number | null;
  /** Any error message */
  error?: string;
}

/** Bridge config stored in settings */
export interface BridgeConfig {
  telegram?: {
    botToken: string;
    allowedUsers?: string[];
    /** Session prefix for Telegram users (default: "tg-") */
    sessionPrefix?: string;
  };
  whatsapp?: {
    sessionPath?: string;
  };
  discord?: {
    botToken: string;
    allowedGuilds?: string[];
  };
}
