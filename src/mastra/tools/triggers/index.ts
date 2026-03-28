/**
 * Karya Trigger Tools — Agent can create, list, and manage triggers
 * 
 * These tools let the agent set up automation:
 * - "Watch my Downloads folder for new PDFs"
 * - "When I copy a URL, summarize it"
 * - "Create a webhook for GitHub push events"
 * - "Show me all active triggers"
 * - "Delete the Downloads watcher"
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  createTrigger,
  listTriggers,
  deleteTrigger,
  toggleTrigger,
  getTriggerStats,
  type TriggerType,
  type TriggerConfig,
} from "../../../lib/triggers";

// ============================================
// trigger-create
// ============================================

export const triggerCreateTool = createTool({
  id: "trigger-create",
  description: `Create an automation trigger. Types:
- "file": Watch a directory for new/changed files. Requires config.path.
- "clipboard": React when user copies text/URL. Optional config.contentType ("url"|"text"|"any").
- "webhook": Create HTTP endpoint for external services. Optional config.secret.
The action is what YOU (the agent) should do when the trigger fires.`,
  inputSchema: z.object({
    type: z.enum(["file", "clipboard", "webhook"]).describe("Trigger type"),
    name: z.string().describe("Human-readable name for this trigger"),
    action: z.string().describe("Instruction for what to do when triggered (sent to you as a message)"),
    watchPath: z.string().optional().describe("For file triggers: directory path to watch"),
    fileEvents: z.array(z.string()).optional().describe("For file triggers: events to watch (create, change, delete, all)"),
    filePattern: z.string().optional().describe("For file triggers: regex pattern to match filenames"),
    contentType: z.enum(["url", "text", "any"]).optional().describe("For clipboard triggers: what type of content to react to"),
    secret: z.string().optional().describe("For webhook triggers: secret token for validation"),
    maxPerHour: z.number().optional().describe("Max fires per hour (0 = unlimited)"),
  }),
  execute: async (input) => {
    try {
      const config: TriggerConfig = {};

      // Build config based on type
      if (input.type === "file") {
        if (!input.watchPath) {
          return { success: false, error: "watchPath is required for file triggers" };
        }
        config.path = input.watchPath;
        config.events = input.fileEvents || ["create", "change"];
        if (input.filePattern) config.pattern = input.filePattern;
      }

      if (input.type === "clipboard") {
        config.contentType = input.contentType || "any";
      }

      if (input.type === "webhook") {
        if (input.secret) config.secret = input.secret;
      }

      if (input.maxPerHour) config.maxPerHour = input.maxPerHour;

      const trigger = createTrigger(
        input.type as TriggerType,
        input.name,
        config,
        input.action
      );

      const result: any = {
        success: true,
        trigger: {
          id: trigger.id,
          type: trigger.type,
          name: trigger.name,
          enabled: trigger.enabled,
        },
      };

      if (input.type === "webhook") {
        result.webhookUrl = `/api/v1/webhook/${trigger.id}`;
        result.note = "External services should POST to this URL";
      }

      if (input.type === "file") {
        result.watching = input.watchPath;
      }

      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
});

// ============================================
// trigger-list
// ============================================

export const triggerListTool = createTool({
  id: "trigger-list",
  description: "List all automation triggers with their status, fire counts, and configuration",
  inputSchema: z.object({}),
  execute: async () => {
    const triggers = listTriggers();
    const stats = getTriggerStats();

    return {
      triggers: triggers.map((t) => ({
        id: t.id,
        type: t.type,
        name: t.name,
        enabled: t.enabled,
        triggerCount: t.triggerCount,
        lastTriggered: t.lastTriggered
          ? new Date(t.lastTriggered).toLocaleString()
          : "never",
        lastError: t.lastError,
        config: t.type === "file"
          ? { path: t.config.path, events: t.config.events, pattern: t.config.pattern }
          : t.type === "clipboard"
          ? { contentType: t.config.contentType }
          : t.type === "webhook"
          ? { hasSecret: !!t.config.secret, url: `/api/v1/webhook/${t.id}` }
          : {},
      })),
      stats,
    };
  },
});

// ============================================
// trigger-delete
// ============================================

export const triggerDeleteTool = createTool({
  id: "trigger-delete",
  description: "Delete an automation trigger by its ID. Stops the watcher and removes it completely.",
  inputSchema: z.object({
    id: z.string().describe("Trigger ID to delete"),
  }),
  execute: async (input) => {
    const success = deleteTrigger(input.id);
    return {
      success,
      message: success
        ? `Trigger ${input.id} deleted`
        : `Trigger ${input.id} not found`,
    };
  },
});

// ============================================
// trigger-toggle
// ============================================

export const triggerToggleTool = createTool({
  id: "trigger-toggle",
  description: "Enable or disable a trigger without deleting it",
  inputSchema: z.object({
    id: z.string().describe("Trigger ID"),
    enabled: z.boolean().optional().describe("true to enable, false to disable. Omit to toggle."),
  }),
  execute: async (input) => {
    const success = toggleTrigger(input.id, input.enabled);
    return {
      success,
      message: success
        ? `Trigger ${input.id} toggled`
        : `Trigger ${input.id} not found`,
    };
  },
});
