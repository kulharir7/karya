/**
 * Karya Plugin Registry — Discovery, installation, and auto-loading
 * 
 * Plugin structure:
 *   workspace/plugins/<plugin-name>/
 *   ├── plugin.json          — Manifest (name, version, description, tools, hooks)
 *   ├── SKILL.md             — Optional agent instructions (loaded into context)
 *   ├── tools.ts             — Tool definitions (dynamic import)
 *   └── README.md            — Optional documentation
 * 
 * plugin.json format:
 * {
 *   "name": "github",
 *   "version": "1.0.0",
 *   "description": "GitHub operations — repos, issues, PRs",
 *   "author": "Ravi",
 *   "tools": ["github-create-issue", "github-list-repos"],
 *   "triggers": ["github", "repo", "issue", "PR"],
 *   "hooks": { "before_tool_call": true },
 *   "dependencies": [],
 *   "config": { "GITHUB_TOKEN": { "required": true, "description": "GitHub personal access token" } }
 * }
 * 
 * Auto-loading:
 *   On startup, scans workspace/plugins/ and loads all plugins with plugin.json
 *   Plugin tools get injected into the supervisor agent via MCP toolsets
 * 
 * Install from URL:
 *   karya plugin install https://github.com/user/karya-plugin-github.git
 *   karya plugin install ./my-local-plugin
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";
import { eventBus } from "./event-bus";
import {
  createPlugin,
  getPlugins,
  unregisterPlugin,
  type PluginMeta,
  type Plugin,
} from "./plugin-api";

// ============================================
// TYPES
// ============================================

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  tools?: string[];
  triggers?: string[];
  hooks?: Record<string, boolean>;
  dependencies?: string[];
  config?: Record<string, { required?: boolean; description?: string; default?: any }>;
}

export interface InstalledPlugin {
  id: string;
  manifest: PluginManifest;
  path: string;
  enabled: boolean;
  hasSkill: boolean;
  hasTools: boolean;
  installedAt: number;
  loadError?: string;
}

// ============================================
// CONSTANTS
// ============================================

const PLUGINS_DIR = path.join(process.cwd(), "workspace", "plugins");
const REGISTRY_FILE = path.join(PLUGINS_DIR, "_registry.json");

// ============================================
// STATE
// ============================================

const installedPlugins = new Map<string, InstalledPlugin>();

// ============================================
// INITIALIZATION
// ============================================

/**
 * Ensure plugins directory exists.
 */
function ensurePluginsDir(): void {
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }
}

/**
 * Scan and auto-load all plugins from workspace/plugins/.
 * Called once on startup.
 */
export async function loadAllPlugins(): Promise<{
  loaded: string[];
  failed: Array<{ id: string; error: string }>;
}> {
  ensurePluginsDir();

  const loaded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  try {
    const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("_")) continue; // Skip internal files

      const pluginPath = path.join(PLUGINS_DIR, entry.name);
      const result = await loadPlugin(entry.name, pluginPath);

      if (result.success) {
        loaded.push(entry.name);
      } else {
        failed.push({ id: entry.name, error: result.error || "Unknown error" });
      }
    }
  } catch (err: any) {
    logger.error("plugin-registry", `Failed to scan plugins: ${err.message}`);
  }

  logger.info("plugin-registry", `Loaded ${loaded.length} plugins (${failed.length} failed)`);
  saveRegistry();
  return { loaded, failed };
}

/**
 * Load a single plugin from its directory.
 */
async function loadPlugin(
  id: string,
  pluginPath: string
): Promise<{ success: boolean; error?: string }> {
  // Read manifest
  const manifestPath = path.join(pluginPath, "plugin.json");

  if (!fs.existsSync(manifestPath)) {
    // No manifest — try SKILL.md only (legacy skill format)
    const skillPath = path.join(pluginPath, "SKILL.md");
    if (fs.existsSync(skillPath)) {
      // Register as skill-only plugin
      installedPlugins.set(id, {
        id,
        manifest: { name: id, version: "0.0.0", description: "Skill-only plugin (no plugin.json)" },
        path: pluginPath,
        enabled: true,
        hasSkill: true,
        hasTools: false,
        installedAt: Date.now(),
      });
      return { success: true };
    }
    return { success: false, error: "No plugin.json or SKILL.md found" };
  }

  try {
    const manifestRaw = fs.readFileSync(manifestPath, "utf-8");
    const manifest: PluginManifest = JSON.parse(manifestRaw);

    if (!manifest.name || !manifest.version) {
      return { success: false, error: "plugin.json missing name or version" };
    }

    const hasSkill = fs.existsSync(path.join(pluginPath, "SKILL.md"));
    const hasTools = fs.existsSync(path.join(pluginPath, "tools.ts")) ||
                     fs.existsSync(path.join(pluginPath, "tools.js"));

    // Register in plugin-api (for tools/hooks)
    if (hasTools) {
      try {
        // Dynamic import of tools file
        const toolsPath = path.join(pluginPath, "tools");
        const toolsModule = await import(toolsPath);

        if (toolsModule.default && typeof toolsModule.default === "function") {
          // Plugin exports a register function
          toolsModule.default();
        } else if (toolsModule.plugin) {
          // Plugin exports a pre-built plugin
          toolsModule.plugin.register();
        }
      } catch (toolErr: any) {
        logger.warn("plugin-registry", `Plugin ${id} tools failed to load: ${toolErr.message}`);
        // Still register the plugin (skill might work)
      }
    }

    installedPlugins.set(id, {
      id,
      manifest,
      path: pluginPath,
      enabled: true,
      hasSkill,
      hasTools,
      installedAt: Date.now(),
    });

    logger.info("plugin-registry", `Loaded: ${manifest.name} v${manifest.version}`);
    await eventBus.emit("plugin:loaded", { id, name: manifest.name, version: manifest.version });

    return { success: true };
  } catch (err: any) {
    installedPlugins.set(id, {
      id,
      manifest: { name: id, version: "?", description: "Failed to load" },
      path: pluginPath,
      enabled: false,
      hasSkill: false,
      hasTools: false,
      installedAt: Date.now(),
      loadError: err.message,
    });
    return { success: false, error: err.message };
  }
}

// ============================================
// INSTALL / UNINSTALL
// ============================================

/**
 * Install a plugin from a local directory path.
 * Copies the directory into workspace/plugins/.
 */
export async function installFromPath(sourcePath: string): Promise<{
  success: boolean;
  pluginId?: string;
  error?: string;
}> {
  ensurePluginsDir();

  if (!fs.existsSync(sourcePath)) {
    return { success: false, error: `Path not found: ${sourcePath}` };
  }

  // Determine plugin name from directory or manifest
  let pluginId = path.basename(sourcePath);
  const manifestPath = path.join(sourcePath, "plugin.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (manifest.name) pluginId = manifest.name;
    } catch { }
  }

  const destPath = path.join(PLUGINS_DIR, pluginId);

  // Don't overwrite
  if (fs.existsSync(destPath)) {
    return { success: false, error: `Plugin ${pluginId} already installed. Uninstall first.` };
  }

  try {
    // Copy directory
    copyDirSync(sourcePath, destPath);

    // Load the plugin
    const result = await loadPlugin(pluginId, destPath);
    saveRegistry();

    return { success: result.success, pluginId, error: result.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Create a new plugin scaffold in workspace/plugins/.
 */
export function scaffoldPlugin(
  name: string,
  description: string = "",
  withTools: boolean = false
): { success: boolean; path?: string; error?: string } {
  ensurePluginsDir();

  const pluginId = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const pluginPath = path.join(PLUGINS_DIR, pluginId);

  if (fs.existsSync(pluginPath)) {
    return { success: false, error: `Plugin ${pluginId} already exists` };
  }

  try {
    fs.mkdirSync(pluginPath, { recursive: true });

    // plugin.json
    const manifest: PluginManifest = {
      name: pluginId,
      version: "1.0.0",
      description: description || `${name} plugin for Karya`,
      author: "User",
      tools: [],
      triggers: [pluginId],
    };
    fs.writeFileSync(
      path.join(pluginPath, "plugin.json"),
      JSON.stringify(manifest, null, 2),
      "utf-8"
    );

    // SKILL.md
    fs.writeFileSync(
      path.join(pluginPath, "SKILL.md"),
      `---
name: ${name}
description: ${description || `${name} plugin`}
triggers: ${pluginId}
---

# ${name}

Instructions for the agent when this plugin is activated.

## What This Plugin Does

(Describe what the agent should do when this skill is triggered)

## Examples

- "Use ${pluginId} to ..."
`,
      "utf-8"
    );

    // tools.ts (optional)
    if (withTools) {
      fs.writeFileSync(
        path.join(pluginPath, "tools.ts"),
        `/**
 * ${name} Plugin Tools
 * 
 * Export a register function or a pre-built plugin.
 */

import { createPlugin } from "../../src/lib/plugin-api";
import { z } from "zod";

export const plugin = createPlugin({
  id: "${pluginId}",
  name: "${name}",
  version: "1.0.0",
  description: "${description || `${name} plugin`}",
})
  .tool({
    id: "${pluginId}-example",
    description: "Example tool for ${name}",
    inputSchema: z.object({
      input: z.string().describe("Input text"),
    }),
    execute: async ({ input }) => {
      return { result: \`Processed: \${input}\` };
    },
  })
  .register();
`,
        "utf-8"
      );
    }

    // README.md
    fs.writeFileSync(
      path.join(pluginPath, "README.md"),
      `# ${name} Plugin

${description || `A Karya plugin for ${name}.`}

## Installation

Copy this folder to \`workspace/plugins/\` in your Karya installation.

## Configuration

(Add any required environment variables or settings here)
`,
      "utf-8"
    );

    return { success: true, path: pluginPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Uninstall a plugin (removes from disk).
 */
export function uninstallPlugin(pluginId: string): { success: boolean; error?: string } {
  const plugin = installedPlugins.get(pluginId);
  if (!plugin) {
    return { success: false, error: "Plugin not found" };
  }

  try {
    // Unregister from plugin-api
    unregisterPlugin(pluginId);

    // Remove from disk
    if (fs.existsSync(plugin.path)) {
      fs.rmSync(plugin.path, { recursive: true, force: true });
    }

    // Remove from registry
    installedPlugins.delete(pluginId);
    saveRegistry();

    logger.info("plugin-registry", `Uninstalled: ${pluginId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// QUERY
// ============================================

/**
 * List all installed plugins.
 */
export function listInstalledPlugins(): InstalledPlugin[] {
  return Array.from(installedPlugins.values());
}

/**
 * Get a specific installed plugin.
 */
export function getInstalledPlugin(id: string): InstalledPlugin | undefined {
  return installedPlugins.get(id);
}

/**
 * Enable or disable a plugin.
 */
export function togglePluginEnabled(id: string, enabled?: boolean): boolean {
  const plugin = installedPlugins.get(id);
  if (!plugin) return false;

  plugin.enabled = enabled !== undefined ? enabled : !plugin.enabled;
  saveRegistry();
  return true;
}

/**
 * Get plugin stats.
 */
export function getPluginRegistryStats(): {
  total: number;
  enabled: number;
  withSkills: number;
  withTools: number;
  failed: number;
} {
  const all = Array.from(installedPlugins.values());
  return {
    total: all.length,
    enabled: all.filter((p) => p.enabled).length,
    withSkills: all.filter((p) => p.hasSkill).length,
    withTools: all.filter((p) => p.hasTools).length,
    failed: all.filter((p) => !!p.loadError).length,
  };
}

/**
 * Get all plugin SKILL.md contents (for context injection).
 */
export function getPluginSkillContexts(): string {
  const skills: string[] = [];

  for (const plugin of installedPlugins.values()) {
    if (!plugin.enabled || !plugin.hasSkill) continue;

    const skillPath = path.join(plugin.path, "SKILL.md");
    try {
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, "utf-8");
        // Strip frontmatter
        const body = content.replace(/^---[\s\S]*?---\n*/, "").trim();
        if (body) {
          skills.push(`### Plugin: ${plugin.manifest.name}\n${body}`);
        }
      }
    } catch { }
  }

  if (skills.length === 0) return "";
  return `\n## Active Plugin Skills\n\n${skills.join("\n\n---\n\n")}\n`;
}

// ============================================
// PERSISTENCE
// ============================================

function saveRegistry(): void {
  try {
    ensurePluginsDir();
    const data = Array.from(installedPlugins.entries()).map(([id, p]) => ({
      id,
      enabled: p.enabled,
      installedAt: p.installedAt,
    }));
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch { }
}

function loadRegistry(): void {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
      for (const entry of data) {
        const existing = installedPlugins.get(entry.id);
        if (existing) {
          existing.enabled = entry.enabled;
          existing.installedAt = entry.installedAt;
        }
      }
    }
  } catch { }
}

// ============================================
// UTILITIES
// ============================================

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
