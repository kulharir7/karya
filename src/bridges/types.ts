/**
 * Karya Bridges — Types
 */

export type ChannelType = "web" | "telegram" | "whatsapp" | "discord";

export interface IncomingMessage {
  channel: ChannelType;
  userId: string;
  chatId: string;
  text: string;
  images?: Buffer[];
  replyTo?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface OutgoingMessage {
  channel: ChannelType;
  chatId: string;
  text: string;
  replyTo?: string;
  markdown?: boolean;
  buttons?: Array<{ text: string; callback: string }>;
}

export interface ChannelBridge {
  type: ChannelType;
  init(): Promise<void>;
  send(message: OutgoingMessage): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export interface GatewayConfig {
  telegram?: {
    botToken: string;
    allowedUsers?: string[];
  };
  whatsapp?: {
    sessionPath?: string;
  };
  discord?: {
    botToken: string;
    allowedGuilds?: string[];
  };
}
