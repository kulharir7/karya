/**
 * Karya Plugin API — Real extensibility
 * 
 * Allows external plugins to:
 * 1. Register custom tools
 * 2. Hook into lifecycle events
 * 3. Add middleware
 * 4. Extend agents
 * 
 * Like OpenClaw's skill system but with JS/TS execution.
 */

import { z } from "zod";
import { eventBus, KaryaEvent } from "./event-bus";
import { createTool } from "@mastra/core/tools";

// Plugin metadata
export interface PluginMeta {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
}

// Tool definition for plugins
export interface PluginToolDef {
  id: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  outputSchema?: z.ZodObject<any>;
  execute: (args: any, context?: PluginContext) => Promise<any>;
}

// Context passed to plugin tools
export interface PluginContext {
  sessionId?: string;
  userId?: string;
  callTool: (toolId: string, args: any) => Promise<any>;
  emit: (event: string, data: any) => void;
  log: (message: string) => void;
}

// Hook handler type
export type HookHandler = (data: any, context: PluginContext) => Promise<any> | any;

// Middleware type
export type Middleware = (
  req: { tool: string; args: any },
  next: () => Promise<any>
) => Promise<any>;

// Plugin instance
export interface Plugin {
  meta: PluginMeta;
  tools: Map<string, PluginToolDef>;
  hooks: Map<string, HookHandler[]>;
  middleware: Middleware[];
  enabled: boolean;
  loadedAt: number;
}

// Plugin registry
const plugins: Map<string, Plugin> = new Map();
const registeredTools: Map<string, PluginToolDef> = new Map();
const globalMiddleware: Middleware[] = [];

/**
 * Create a new plugin
 */
export function createPlugin(meta: PluginMeta): PluginBuilder {
  return new PluginBuilder(meta);
}

/**
 * Plugin builder class for fluent API
 */
export class PluginBuilder {
  private plugin: Plugin;

  constructor(meta: PluginMeta) {
    this.plugin = {
      meta,
      tools: new Map(),
      hooks: new Map(),
      middleware: [],
      enabled: true,
      loadedAt: Date.now(),
    };
  }

  /**
   * Register a tool
   */
  tool(def: PluginToolDef): PluginBuilder {
    this.plugin.tools.set(def.id, def);
    return this;
  }

  /**
   * Register an event hook
   */
  on(event: string, handler: HookHandler): PluginBuilder {
    const handlers = this.plugin.hooks.get(event) || [];
    handlers.push(handler);
    this.plugin.hooks.set(event, handlers);
    return this;
  }

  /**
   * Add middleware
   */
  use(middleware: Middleware): PluginBuilder {
    this.plugin.middleware.push(middleware);
    return this;
  }

  /**
   * Build and register the plugin
   */
  register(): Plugin {
    // Register plugin
    plugins.set(this.plugin.meta.id, this.plugin);

    // Register tools globally
    for (const [id, tool] of this.plugin.tools) {
      registeredTools.set(id, tool);
    }

    // Register event hooks
    for (const [event, handlers] of this.plugin.hooks) {
      for (const handler of handlers) {
        eventBus.on(event as KaryaEvent, (data) => {
          const context = createPluginContext();
          handler(data, context);
        });
      }
    }

    // Add middleware
    globalMiddleware.push(...this.plugin.middleware);

    console.log(`[plugin] Registered: ${this.plugin.meta.name} v${this.plugin.meta.version}`);

    eventBus.emit("plugin:loaded", {
      id: this.plugin.meta.id,
      name: this.plugin.meta.name,
    });

    return this.plugin;
  }
}

/**
 * Create plugin context
 */
function createPluginContext(sessionId?: string): PluginContext {
  return {
    sessionId,
    callTool: async (toolId: string, args: any) => {
      const tool = registeredTools.get(toolId);
      if (!tool) throw new Error(`Tool not found: ${toolId}`);
      return tool.execute(args, createPluginContext(sessionId));
    },
    emit: (event: string, data: any) => {
      eventBus.emit(`custom:${event}` as KaryaEvent, data);
    },
    log: (message: string) => {
      console.log(`[plugin] ${message}`);
    },
  };
}

/**
 * Get all registered plugins
 */
export function getPlugins(): Plugin[] {
  return Array.from(plugins.values());
}

/**
 * Get plugin by ID
 */
export function getPlugin(id: string): Plugin | undefined {
  return plugins.get(id);
}

/**
 * Get all plugin tools
 */
export function getPluginTools(): PluginToolDef[] {
  return Array.from(registeredTools.values());
}

/**
 * Get plugin tool by ID
 */
export function getPluginTool(id: string): PluginToolDef | undefined {
  return registeredTools.get(id);
}

/**
 * Execute a plugin tool
 */
export async function executePluginTool(
  toolId: string,
  args: any,
  sessionId?: string
): Promise<any> {
  const tool = registeredTools.get(toolId);
  if (!tool) {
    throw new Error(`Plugin tool not found: ${toolId}`);
  }

  const context = createPluginContext(sessionId);

  // Run through middleware
  let result: any;
  const runMiddleware = async (index: number): Promise<any> => {
    if (index >= globalMiddleware.length) {
      // Execute tool
      return tool.execute(args, context);
    }

    return globalMiddleware[index](
      { tool: toolId, args },
      () => runMiddleware(index + 1)
    );
  };

  result = await runMiddleware(0);
  return result;
}

/**
 * Enable/disable plugin
 */
export function togglePlugin(id: string, enabled: boolean): boolean {
  const plugin = plugins.get(id);
  if (!plugin) return false;

  plugin.enabled = enabled;
  return true;
}

/**
 * Unregister a plugin
 */
export function unregisterPlugin(id: string): boolean {
  const plugin = plugins.get(id);
  if (!plugin) return false;

  // Remove tools
  for (const toolId of plugin.tools.keys()) {
    registeredTools.delete(toolId);
  }

  // Remove plugin
  plugins.delete(id);

  console.log(`[plugin] Unregistered: ${plugin.meta.name}`);
  return true;
}

/**
 * Get plugin stats
 */
export function getPluginStats(): {
  totalPlugins: number;
  enabledPlugins: number;
  totalTools: number;
  totalMiddleware: number;
} {
  const allPlugins = Array.from(plugins.values());
  return {
    totalPlugins: allPlugins.length,
    enabledPlugins: allPlugins.filter((p) => p.enabled).length,
    totalTools: registeredTools.size,
    totalMiddleware: globalMiddleware.length,
  };
}

/**
 * Convert plugin tool to Mastra tool format
 */
export function toMastraTool(pluginTool: PluginToolDef) {
  return createTool({
    id: pluginTool.id,
    description: pluginTool.description,
    inputSchema: pluginTool.inputSchema,
    outputSchema: pluginTool.outputSchema || z.any(),
    execute: async (args) => {
      return executePluginTool(pluginTool.id, args);
    },
  });
}

/**
 * Load plugin from file (dynamic import)
 */
export async function loadPluginFile(filePath: string): Promise<Plugin | null> {
  try {
    const module = await import(filePath);
    if (module.default && typeof module.default === "function") {
      return module.default();
    }
    if (module.plugin) {
      return module.plugin;
    }
    console.error(`[plugin] Invalid plugin file: ${filePath}`);
    return null;
  } catch (err: any) {
    console.error(`[plugin] Failed to load: ${filePath}`, err.message);
    return null;
  }
}

// ============================================
// EXAMPLE PLUGINS
// ============================================

/**
 * Example: Logging plugin
 */
export const loggingPlugin = createPlugin({
  id: "karya-logging",
  name: "Logging Plugin",
  version: "1.0.0",
  description: "Logs all tool calls",
})
  .on("tool:before_call", (data, ctx) => {
    ctx.log(`Tool call: ${data.tool} with args: ${JSON.stringify(data.args)}`);
  })
  .on("tool:after_call", (data, ctx) => {
    ctx.log(`Tool result: ${data.tool} returned: ${JSON.stringify(data.result).slice(0, 100)}`);
  });

/**
 * Example: Rate limit middleware
 */
const rateLimitCounts: Map<string, { count: number; resetAt: number }> = new Map();

export const rateLimitMiddleware: Middleware = async (req, next) => {
  const key = req.tool;
  const now = Date.now();
  const limit = 60; // 60 calls per minute
  const window = 60000; // 1 minute

  let entry = rateLimitCounts.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + window };
    rateLimitCounts.set(key, entry);
  }

  if (entry.count >= limit) {
    throw new Error(`Rate limit exceeded for tool: ${key}`);
  }

  entry.count++;
  return next();
};

/**
 * Example: Custom tool plugin
 */
export const exampleToolPlugin = createPlugin({
  id: "example-tools",
  name: "Example Tools",
  version: "1.0.0",
})
  .tool({
    id: "hello-world",
    description: "A simple hello world tool",
    inputSchema: z.object({
      name: z.string().describe("Name to greet"),
    }),
    execute: async ({ name }) => {
      return { message: `Hello, ${name}!` };
    },
  })
  .tool({
    id: "random-number",
    description: "Generate a random number",
    inputSchema: z.object({
      min: z.number().default(0),
      max: z.number().default(100),
    }),
    execute: async ({ min, max }) => {
      const num = Math.floor(Math.random() * (max - min + 1)) + min;
      return { number: num };
    },
  });
