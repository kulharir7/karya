/**
 * Karya Event Bus — Central event system for lifecycle hooks.
 * 
 * Like OpenClaw's hook system: before_tool_call, after_tool_call,
 * message_received, agent_start, agent_end, etc.
 * 
 * All components communicate through events.
 * Plugins can hook into any lifecycle point.
 */

export type EventHandler = (...args: any[]) => void | Promise<void>;

interface EventSubscription {
  id: string;
  handler: EventHandler;
  once: boolean;
}

// All possible lifecycle events
export type KaryaEvent =
  // Agent lifecycle
  | "agent:start"          // agent run begins
  | "agent:end"            // agent run completes
  | "agent:error"          // agent encountered an error
  | "agent:abort"          // agent run was aborted by user
  // Tool lifecycle
  | "tool:before_call"     // before a tool is executed
  | "tool:after_call"      // after a tool returns
  | "tool:error"           // tool execution failed
  // Message lifecycle
  | "message:received"     // user message received
  | "message:sending"      // assistant message about to be sent
  | "message:sent"         // assistant message sent
  // Session lifecycle
  | "session:created"      // new session created
  | "session:switched"     // user switched to different session
  | "session:deleted"      // session was deleted
  | "session:cleared"      // session messages cleared
  // System events
  | "system:ready"         // karya server is ready
  | "system:shutdown"      // karya server shutting down
  | "mcp:connected"        // MCP server connected
  | "mcp:disconnected"     // MCP server disconnected
  | "mcp:tools_updated"    // MCP tools list changed
  // Plugin events
  | "plugin:loaded"        // plugin was loaded
  | "plugin:error"         // plugin failed to load
  // Workflow events
  | "workflow:created"     // workflow run created
  | "workflow:updated"     // workflow run status updated
  // Trigger events
  | "trigger:created"      // trigger was created
  | "trigger:fired"        // trigger was fired
  | "trigger:deleted"      // trigger was deleted
  | "workflow:deleted"     // workflow run deleted
  // Custom events (for user plugins)
  | `custom:${string}`;

class EventBus {
  private listeners: Map<string, EventSubscription[]> = new Map();
  private eventLog: { event: string; timestamp: number; args?: any }[] = [];
  private maxLogSize = 1000;

  /**
   * Subscribe to an event.
   * Returns an unsubscribe function.
   */
  on(event: KaryaEvent, handler: EventHandler): () => void {
    const id = `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const sub: EventSubscription = { id, handler, once: false };

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(sub);

    // Return unsubscribe function
    return () => {
      const subs = this.listeners.get(event);
      if (subs) {
        const idx = subs.findIndex((s) => s.id === id);
        if (idx !== -1) subs.splice(idx, 1);
      }
    };
  }

  /**
   * Subscribe to an event, auto-unsubscribe after first trigger.
   */
  once(event: KaryaEvent, handler: EventHandler): () => void {
    const id = `${event}-once-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const sub: EventSubscription = { id, handler, once: true };

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(sub);

    return () => {
      const subs = this.listeners.get(event);
      if (subs) {
        const idx = subs.findIndex((s) => s.id === id);
        if (idx !== -1) subs.splice(idx, 1);
      }
    };
  }

  /**
   * Emit an event. All handlers are called in order.
   * Async handlers are awaited.
   */
  async emit(event: KaryaEvent, ...args: any[]): Promise<void> {
    // Log event
    this.eventLog.push({
      event,
      timestamp: Date.now(),
      args: args.length > 0 ? this.summarizeArgs(args) : undefined,
    });
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }

    const subs = this.listeners.get(event);
    if (!subs || subs.length === 0) return;

    const toRemove: string[] = [];

    for (const sub of subs) {
      try {
        await sub.handler(...args);
      } catch (err) {
        console.error(`[EventBus] Handler error for '${event}':`, err);
      }
      if (sub.once) {
        toRemove.push(sub.id);
      }
    }

    // Remove one-time handlers
    if (toRemove.length > 0) {
      const remaining = subs.filter((s) => !toRemove.includes(s.id));
      this.listeners.set(event, remaining);
    }
  }

  /**
   * Get the event log (last N events).
   */
  getLog(limit: number = 50): { event: string; timestamp: number; args?: any }[] {
    return this.eventLog.slice(-limit);
  }

  /**
   * Get listener count for an event.
   */
  listenerCount(event: KaryaEvent): number {
    return this.listeners.get(event)?.length || 0;
  }

  /**
   * Remove all listeners for an event.
   */
  removeAll(event: KaryaEvent): void {
    this.listeners.delete(event);
  }

  /**
   * Clear everything.
   */
  reset(): void {
    this.listeners.clear();
    this.eventLog = [];
  }

  // Keep log args small
  private summarizeArgs(args: any[]): any {
    return args.map((a) => {
      if (typeof a === "string") return a.slice(0, 200);
      if (typeof a === "number" || typeof a === "boolean") return a;
      if (a === null || a === undefined) return a;
      try {
        const json = JSON.stringify(a);
        return json.length > 500 ? json.slice(0, 500) + "..." : JSON.parse(json);
      } catch {
        return "[object]";
      }
    });
  }
}

// Singleton — one event bus for the entire app
export const eventBus = new EventBus();
