/**
 * Karya Triggers — Event-based automation
 * 
 * Types:
 * 1. File Watcher — React to file changes
 * 2. Clipboard Watcher — React to clipboard changes
 * 3. Webhook — React to HTTP requests
 */

import * as fs from "fs";
import * as path from "path";
import { EventEmitter } from "events";
import { eventBus } from "./event-bus";

// Trigger types
export type TriggerType = "file" | "clipboard" | "webhook";

export interface Trigger {
  id: string;
  type: TriggerType;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  action: string; // Task to run when triggered
  createdAt: number;
  lastTriggered?: number;
  triggerCount: number;
}

// Trigger registry
const triggers: Map<string, Trigger> = new Map();
const watchers: Map<string, fs.FSWatcher> = new Map();

// Clipboard state
let lastClipboard = "";
let clipboardInterval: NodeJS.Timeout | null = null;

/**
 * Create a new trigger
 */
export function createTrigger(
  type: TriggerType,
  name: string,
  config: Record<string, any>,
  action: string
): Trigger {
  const id = `trigger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  
  const trigger: Trigger = {
    id,
    type,
    name,
    enabled: true,
    config,
    action,
    createdAt: Date.now(),
    triggerCount: 0,
  };
  
  triggers.set(id, trigger);
  
  // Start the trigger
  startTrigger(trigger);
  
  eventBus.emit("trigger:created", { id, type, name });
  
  return trigger;
}

/**
 * Start a trigger
 */
function startTrigger(trigger: Trigger): void {
  switch (trigger.type) {
    case "file":
      startFileWatcher(trigger);
      break;
    case "clipboard":
      startClipboardWatcher(trigger);
      break;
    case "webhook":
      // Webhooks are handled via API route
      break;
  }
}

/**
 * Stop a trigger
 */
function stopTrigger(trigger: Trigger): void {
  switch (trigger.type) {
    case "file":
      const watcher = watchers.get(trigger.id);
      if (watcher) {
        watcher.close();
        watchers.delete(trigger.id);
      }
      break;
    case "clipboard":
      // Clipboard watcher is shared, don't stop unless no clipboard triggers
      const hasClipboardTriggers = Array.from(triggers.values()).some(
        t => t.type === "clipboard" && t.enabled && t.id !== trigger.id
      );
      if (!hasClipboardTriggers && clipboardInterval) {
        clearInterval(clipboardInterval);
        clipboardInterval = null;
      }
      break;
  }
}

/**
 * File Watcher
 */
function startFileWatcher(trigger: Trigger): void {
  const { path: watchPath, events = ["create", "change"] } = trigger.config;
  
  if (!watchPath || !fs.existsSync(watchPath)) {
    console.log(`[triggers] Path not found: ${watchPath}`);
    return;
  }
  
  try {
    const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
      if (!trigger.enabled) return;
      if (!filename) return;
      
      // Check event type filter
      const eventMap: Record<string, string> = {
        rename: "create", // Could be create or delete
        change: "change",
      };
      
      const mappedEvent = eventMap[eventType] || eventType;
      if (!events.includes(mappedEvent) && !events.includes("all")) return;
      
      // Check file pattern filter
      const { pattern } = trigger.config;
      if (pattern) {
        const regex = new RegExp(pattern, "i");
        if (!regex.test(filename)) return;
      }
      
      // Trigger the action
      fireTrigger(trigger, {
        event: eventType,
        filename,
        path: path.join(watchPath, filename),
      });
    });
    
    watchers.set(trigger.id, watcher);
    console.log(`[triggers] File watcher started: ${watchPath}`);
  } catch (err: any) {
    console.error(`[triggers] Failed to start file watcher:`, err.message);
  }
}

/**
 * Clipboard Watcher
 */
function startClipboardWatcher(trigger: Trigger): void {
  // Only start one clipboard interval for all clipboard triggers
  if (clipboardInterval) return;
  
  const checkClipboard = async () => {
    try {
      // Use PowerShell to read clipboard
      const { execSync } = await import("child_process");
      const content = execSync("powershell -command Get-Clipboard", {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      
      if (content && content !== lastClipboard) {
        const oldClipboard = lastClipboard;
        lastClipboard = content;
        
        // Fire all enabled clipboard triggers
        for (const t of triggers.values()) {
          if (t.type !== "clipboard" || !t.enabled) continue;
          
          // Check content filter
          const { contentType, pattern } = t.config;
          
          // URL detection
          if (contentType === "url" && !content.match(/^https?:\/\//i)) continue;
          
          // Pattern match
          if (pattern) {
            const regex = new RegExp(pattern, "i");
            if (!regex.test(content)) continue;
          }
          
          fireTrigger(t, {
            content,
            previousContent: oldClipboard,
            contentType: content.match(/^https?:\/\//i) ? "url" : "text",
          });
        }
      }
    } catch {
      // Ignore clipboard read errors
    }
  };
  
  // Check every 2 seconds
  clipboardInterval = setInterval(checkClipboard, 2000);
  console.log("[triggers] Clipboard watcher started");
}

/**
 * Fire a trigger (execute its action)
 */
async function fireTrigger(trigger: Trigger, data: Record<string, any>): Promise<void> {
  trigger.lastTriggered = Date.now();
  trigger.triggerCount++;
  
  console.log(`[triggers] Fired: ${trigger.name}`, data);
  
  eventBus.emit("trigger:fired", {
    id: trigger.id,
    name: trigger.name,
    type: trigger.type,
    data,
  });
  
  // Execute the action via chat API
  try {
    const message = `[TRIGGER: ${trigger.name}]\n${trigger.action}\n\nContext: ${JSON.stringify(data)}`;
    
    const response = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        sessionId: `trigger-${trigger.id}`,
      }),
    });
    
    if (!response.ok) {
      console.error(`[triggers] Action failed: ${response.status}`);
    }
  } catch (err: any) {
    console.error(`[triggers] Action error:`, err.message);
  }
}

/**
 * Handle webhook trigger
 */
export function handleWebhook(triggerId: string, payload: any): boolean {
  const trigger = triggers.get(triggerId);
  if (!trigger || trigger.type !== "webhook" || !trigger.enabled) {
    return false;
  }
  
  fireTrigger(trigger, { payload });
  return true;
}

/**
 * List all triggers
 */
export function listTriggers(): Trigger[] {
  return Array.from(triggers.values());
}

/**
 * Get trigger by ID
 */
export function getTrigger(id: string): Trigger | undefined {
  return triggers.get(id);
}

/**
 * Toggle trigger
 */
export function toggleTrigger(id: string, enabled: boolean): boolean {
  const trigger = triggers.get(id);
  if (!trigger) return false;
  
  trigger.enabled = enabled;
  
  if (enabled) {
    startTrigger(trigger);
  } else {
    stopTrigger(trigger);
  }
  
  return true;
}

/**
 * Delete trigger
 */
export function deleteTrigger(id: string): boolean {
  const trigger = triggers.get(id);
  if (!trigger) return false;
  
  stopTrigger(trigger);
  triggers.delete(id);
  
  eventBus.emit("trigger:deleted", { id });
  
  return true;
}

/**
 * Get trigger stats
 */
export function getTriggerStats(): {
  total: number;
  active: number;
  byType: Record<string, number>;
} {
  const all = Array.from(triggers.values());
  
  return {
    total: all.length,
    active: all.filter(t => t.enabled).length,
    byType: {
      file: all.filter(t => t.type === "file").length,
      clipboard: all.filter(t => t.type === "clipboard").length,
      webhook: all.filter(t => t.type === "webhook").length,
    },
  };
}
