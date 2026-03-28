/**
 * Karya Plugin Registry — UNIFIED skill + plugin system
 * 
 * Phase 6 DEEP REWRITE:
 * 
 * Before: Two separate systems that didn't talk:
 *   - skill-engine.ts → workspace/skills/ (SKILL.md only, no tools, no lifecycle)
 *   - plugin-api.ts → in-memory registration (no disk, no auto-load)
 *   - plugin-loader.ts → reads skills again with gray-matter (duplicate)
 *   
 * Now: ONE unified system:
 *   - workspace/plugins/ is the ONLY plugin directory
 *   - Each plugin has plugin.json (manifest) + SKILL.md (instructions)
 *   - Skills auto-injected into agent context on every turn
 *   - Plugin lifecycle: load → validate config → inject skills → register hooks
 *   - Auto-load on startup, file watcher for hot-reload
 *   - Registry persisted in _registry.json
 * 
 * Plugin structure:
 *   workspace/plugins/<name>/
 *   ├── plugin.json    — Manifest (required for full plugins, optional for skill-only)
 *   ├── SKILL.md       — Agent instructions (loaded into context when enabled)
 *   └── README.md      — Documentation (optional)
 * 
 * Backward compatible:
 *   - workspace/skills/ still scanned (legacy, read-only)
 *   - Plugins without plugin.json treated as skill-only
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";
import { eventBus } from "./event-bus";

// ============================================
// TYPES
// ============================================

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  /** Keywords that activate this plugin's skill */
  triggers?: string[];
  /** Environment variables this plugin needs */
  config?: Record<string, {
    required?: boolean;
    description?: string;
    default?: any;
  }>;
  /** Event bus hooks this plugin listens to */
  hooks?: string[];
  /** Other plugins this depends on */
  dependencies?: string[];
  /** Priority for skill matching (higher = checked first) */
  priority?: number;
}

export interface InstalledPlugin {
  id: string;
  manifest: PluginManifest;
  /** Absolute path to plugin directory */
  dirPath: string;
  /** Whether this plugin is enabled */
  enabled: boolean;
  /** Does this plugin have a SKILL.md? */
  hasSkill: boolean;
  /** Parsed SKILL.md content (body without frontmatter) */
  skillContent: string;
  /** Trigger keywords (from manifest + skill frontmatter) */
  triggers: string[];
  /** When the plugin was first loaded */
  installedAt: number;
  /** Last error during loading */
  loadError: string | null;
  /** Config validation results */
  configStatus: Record<string, { present: boolean; required: boolean }>;
  /** Source: 'plugins' or 'skills' (legacy) */
  source: "plugins" | "skills";
}

// ============================================
// CONSTANTS
// ============================================

const PLUGINS_DIR = path.join(process.cwd(), "workspace", "plugins");
const LEGACY_SKILLS_DIR = path.join(process.cwd(), "workspace", "skills");
const REGISTRY_FILE = path.join(PLUGINS_DIR, "_registry.json");

// ============================================
// STATE
// ============================================

const plugins = new Map<string, InstalledPlugin>();
let initialized = false;
let fileWatcher: fs.FSWatcher | null = null;

// ============================================
// INITIALIZATION
// ============================================

function ensureDirs(): void {
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }
}

/**
 * Scan and load ALL plugins from:
 * 1. workspace/plugins/ (new format with plugin.json)
 * 2. workspace/skills/ (legacy format, SKILL.md only)
 * 
 * Call this once on startup.
 */
export async function loadAllPlugins(): Promise<{
  loaded: string[];
  failed: Array<{ id: string; error: string }>;
}> {
  ensureDirs();
  const loaded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  // Load saved enabled/disabled states
  const savedStates = loadRegistryStates();

  // ---- 1. Scan workspace/plugins/ ----
  if (fs.existsSync(PLUGINS_DIR)) {
    for (const entry of fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

      const result = loadSinglePlugin(
        entry.name,
        path.join(PLUGINS_DIR, entry.name),
        "plugins",
        savedStates
      );

      if (result.success) {
        loaded.push(entry.name);
      } else {
        failed.push({ id: entry.name, error: result.error! });
      }
    }
  }

  // ---- 2. Scan workspace/skills/ (legacy) ----
  if (fs.existsSync(LEGACY_SKILLS_DIR)) {
    for (const entry of fs.readdirSync(LEGACY_SKILLS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(LEGACY_SKILLS_DIR, entry.name);
      const skillFile = path.join(skillPath, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;

      // Don't override if already loaded from plugins/
      if (plugins.has(entry.name)) continue;

      const result = loadSinglePlugin(
        entry.name,
        skillPath,
        "skills",
        savedStates
      );

      if (result.success) {
        loaded.push(`${entry.name} (legacy)`);
      }
    }
  }

  // Start file watcher for hot-reload
  watchPluginsDir();

  initialized = true;
  saveRegistryStates();

  logger.info(
    "plugin-registry",
    `Loaded ${loaded.length} plugins, ${failed.length} failed: [${loaded.join(", ")}]`
  );

  return { loaded, failed };
}

/**
 * Load a single plugin from its directory.
 */
function loadSinglePlugin(
  id: string,
  dirPath: string,
  source: "plugins" | "skills",
  savedStates: Record<string, boolean>
): { success: boolean; error?: string } {
  try {
    // ---- Read manifest (optional) ----
    let manifest: PluginManifest = {
      name: id,
      version: "0.0.0",
      description: "",
    };

    const manifestPath = path.join(dirPath, "plugin.json");
    if (fs.existsSync(manifestPath)) {
      try {
        const raw = fs.readFileSync(manifestPath, "utf-8");
        manifest = { ...manifest, ...JSON.parse(raw) };
      } catch (err: any) {
        return { success: false, error: `Invalid plugin.json: ${err.message}` };
      }
    }

    // ---- Read SKILL.md ----
    let skillContent = "";
    let hasSkill = false;
    let skillTriggers: string[] = [];

    const skillPath = path.join(dirPath, "SKILL.md");
    if (fs.existsSync(skillPath)) {
      const raw = fs.readFileSync(skillPath, "utf-8");
      hasSkill = true;

      // Parse frontmatter
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const fm = fmMatch[1];
        skillContent = raw.slice(fmMatch[0].length).trim();

        // Extract triggers from frontmatter
        const trigLine = fm.match(/triggers:\s*(.+)/i)?.[1] || "";
        skillTriggers = trigLine.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

        // Use frontmatter description if manifest doesn't have one
        if (!manifest.description) {
          manifest.description = fm.match(/description:\s*(.+)/i)?.[1]?.trim() || "";
        }
      } else {
        skillContent = raw.trim();
      }
    }

    if (!hasSkill && !fs.existsSync(manifestPath)) {
      return { success: false, error: "No plugin.json or SKILL.md found" };
    }

    // ---- Merge triggers ----
    const triggers = [
      ...new Set([
        ...(manifest.triggers || []).map((t) => t.toLowerCase()),
        ...skillTriggers,
        id.toLowerCase(), // Plugin name itself is always a trigger
      ]),
    ];

    // ---- Validate config ----
    const configStatus: Record<string, { present: boolean; required: boolean }> = {};
    if (manifest.config) {
      for (const [key, def] of Object.entries(manifest.config)) {
        configStatus[key] = {
          present: !!process.env[key],
          required: !!def.required,
        };
      }
    }

    // ---- Check missing required config ----
    const missingRequired = Object.entries(configStatus)
      .filter(([, v]) => v.required && !v.present)
      .map(([k]) => k);

    if (missingRequired.length > 0) {
      logger.warn(
        "plugin-registry",
        `Plugin ${id}: missing required config: ${missingRequired.join(", ")}`
      );
    }

    // ---- Determine enabled state ----
    const enabled = savedStates[id] !== undefined ? savedStates[id] : true;

    // ---- Register ----
    plugins.set(id, {
      id,
      manifest,
      dirPath,
      enabled,
      hasSkill,
      skillContent,
      triggers,
      installedAt: Date.now(),
      loadError: null,
      configStatus,
      source,
    });

    return { success: true };
  } catch (err: any) {
    plugins.set(id, {
      id,
      manifest: { name: id, version: "?", description: "Failed to load" },
      dirPath,
      enabled: false,
      hasSkill: false,
      skillContent: "",
      triggers: [],
      installedAt: Date.now(),
      loadError: err.message,
      configStatus: {},
      source,
    });
    return { success: false, error: err.message };
  }
}

// ============================================
// CONTEXT INJECTION (THE IMPORTANT PART)
// ============================================

/**
 * Get ALL enabled plugin skills for agent context injection.
 * 
 * This is called by ChatProcessor in Step 3 (context building).
 * Returns formatted text with all active plugin instructions.
 */
export function getActivePluginSkills(): string {
  const sections: string[] = [];

  const enabledPlugins = Array.from(plugins.values())
    .filter((p) => p.enabled && p.hasSkill && p.skillContent)
    .sort((a, b) => (b.manifest.priority || 0) - (a.manifest.priority || 0));

  if (enabledPlugins.length === 0) return "";

  sections.push("## 🔌 Active Plugins\n");
  sections.push("The following plugins are installed. Use their instructions when relevant:\n");

  for (const plugin of enabledPlugins) {
    sections.push(`### ${plugin.manifest.name || plugin.id}`);
    if (plugin.manifest.description) {
      sections.push(`_${plugin.manifest.description}_`);
    }
    sections.push(`Triggers: ${plugin.triggers.join(", ")}\n`);
    // Truncate very long skills
    const maxSkillChars = 2000;
    const content = plugin.skillContent.length > maxSkillChars
      ? plugin.skillContent.slice(0, maxSkillChars) + "\n\n_[...truncated, use skill-load for full content]_"
      : plugin.skillContent;
    sections.push(content);
    sections.push("\n---\n");
  }

  return sections.join("\n");
}

/**
 * Find plugins matching a user query.
 * Returns ranked list of matching plugins.
 */
export function matchPlugins(query: string): InstalledPlugin[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

  const scored: Array<{ plugin: InstalledPlugin; score: number }> = [];

  for (const plugin of plugins.values()) {
    if (!plugin.enabled) continue;

    let score = 0;

    // Trigger match (highest priority)
    for (const trigger of plugin.triggers) {
      if (queryLower.includes(trigger)) score += 10;
      for (const word of queryWords) {
        if (trigger.includes(word) || word.includes(trigger)) score += 3;
      }
    }

    // Name match
    if (queryLower.includes(plugin.id)) score += 8;

    // Description match
    const desc = plugin.manifest.description?.toLowerCase() || "";
    for (const word of queryWords) {
      if (desc.includes(word)) score += 2;
    }

    // Skill content match (light — just first 500 chars)
    const skillPreview = plugin.skillContent.slice(0, 500).toLowerCase();
    for (const word of queryWords) {
      if (skillPreview.includes(word)) score += 1;
    }

    if (score > 0) {
      scored.push({ plugin, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.plugin);
}

/**
 * Load a specific plugin's full SKILL.md content.
 * Used by skill-load tool.
 */
export function loadPluginSkill(pluginId: string): string | null {
  const plugin = plugins.get(pluginId);
  if (!plugin || !plugin.hasSkill) {
    // Also check legacy skills dir
    const legacyPath = path.join(LEGACY_SKILLS_DIR, pluginId, "SKILL.md");
    if (fs.existsSync(legacyPath)) {
      return fs.readFileSync(legacyPath, "utf-8");
    }
    return null;
  }

  // Re-read from disk (in case it was edited)
  const skillPath = path.join(plugin.dirPath, "SKILL.md");
  if (!fs.existsSync(skillPath)) return null;

  try {
    return fs.readFileSync(skillPath, "utf-8");
  } catch {
    return null;
  }
}

// ============================================
// CRUD OPERATIONS
// ============================================

export function listInstalledPlugins(): InstalledPlugin[] {
  return Array.from(plugins.values());
}

export function getInstalledPlugin(id: string): InstalledPlugin | undefined {
  return plugins.get(id);
}

export function togglePluginEnabled(id: string, enabled?: boolean): boolean {
  const plugin = plugins.get(id);
  if (!plugin) return false;
  plugin.enabled = enabled !== undefined ? enabled : !plugin.enabled;
  saveRegistryStates();
  return true;
}

/**
 * Create a new plugin scaffold.
 */
export function scaffoldPlugin(
  name: string,
  description: string = "",
  options: { withTools?: boolean; triggers?: string[] } = {}
): { success: boolean; path?: string; error?: string } {
  ensureDirs();

  const pluginId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
      triggers: options.triggers || [pluginId],
    };
    fs.writeFileSync(
      path.join(pluginPath, "plugin.json"),
      JSON.stringify(manifest, null, 2),
      "utf-8"
    );

    // SKILL.md
    const triggers = (options.triggers || [pluginId]).join(", ");
    fs.writeFileSync(
      path.join(pluginPath, "SKILL.md"),
      `---
name: ${name}
description: ${description || `${name} plugin`}
triggers: ${triggers}
---

# ${name}

Instructions for the agent when this plugin is activated.

## What This Plugin Does

(Describe what the agent should do when this skill is triggered)

## How To Use

(Step-by-step instructions, API endpoints, CLI commands, etc.)

## Examples

- "Use ${pluginId} to ..."
- "Show me ..."
`,
      "utf-8"
    );

    // README.md
    fs.writeFileSync(
      path.join(pluginPath, "README.md"),
      `# ${name} Plugin\n\n${description || `A Karya plugin for ${name}.`}\n\n## Installation\n\nAlready installed in workspace/plugins/.\n`,
      "utf-8"
    );

    // Reload to pick up new plugin
    const savedStates = loadRegistryStates();
    loadSinglePlugin(pluginId, pluginPath, "plugins", savedStates);
    saveRegistryStates();

    return { success: true, path: pluginPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Install plugin from a local path (copy into workspace/plugins/).
 */
export async function installFromPath(sourcePath: string): Promise<{
  success: boolean;
  pluginId?: string;
  error?: string;
}> {
  ensureDirs();

  if (!fs.existsSync(sourcePath)) {
    return { success: false, error: `Path not found: ${sourcePath}` };
  }

  let pluginId = path.basename(sourcePath);
  const manifestPath = path.join(sourcePath, "plugin.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (m.name) pluginId = m.name;
    } catch { }
  }

  const destPath = path.join(PLUGINS_DIR, pluginId);
  if (fs.existsSync(destPath)) {
    return { success: false, error: `Plugin ${pluginId} already installed` };
  }

  try {
    copyDirSync(sourcePath, destPath);
    const savedStates = loadRegistryStates();
    const result = loadSinglePlugin(pluginId, destPath, "plugins", savedStates);
    saveRegistryStates();
    return { success: result.success, pluginId, error: result.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Uninstall a plugin (remove from disk).
 */
export function uninstallPlugin(pluginId: string): { success: boolean; error?: string } {
  const plugin = plugins.get(pluginId);
  if (!plugin) return { success: false, error: "Plugin not found" };

  // Don't allow deleting legacy skills
  if (plugin.source === "skills") {
    return { success: false, error: "Cannot uninstall legacy skills (workspace/skills/). Delete manually." };
  }

  try {
    if (fs.existsSync(plugin.dirPath)) {
      fs.rmSync(plugin.dirPath, { recursive: true, force: true });
    }
    plugins.delete(pluginId);
    saveRegistryStates();
    logger.info("plugin-registry", `Uninstalled: ${pluginId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// STATS
// ============================================

export function getPluginRegistryStats(): {
  total: number;
  enabled: number;
  withSkills: number;
  fromPlugins: number;
  fromLegacySkills: number;
  failed: number;
  configIssues: number;
} {
  const all = Array.from(plugins.values());
  return {
    total: all.length,
    enabled: all.filter((p) => p.enabled).length,
    withSkills: all.filter((p) => p.hasSkill).length,
    fromPlugins: all.filter((p) => p.source === "plugins").length,
    fromLegacySkills: all.filter((p) => p.source === "skills").length,
    failed: all.filter((p) => !!p.loadError).length,
    configIssues: all.filter((p) =>
      Object.values(p.configStatus).some((v) => v.required && !v.present)
    ).length,
  };
}

// ============================================
// FILE WATCHING (HOT RELOAD)
// ============================================

function watchPluginsDir(): void {
  if (fileWatcher) return;
  if (!fs.existsSync(PLUGINS_DIR)) return;

  try {
    let debounce: NodeJS.Timeout | null = null;

    fileWatcher = fs.watch(PLUGINS_DIR, { recursive: true }, () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(async () => {
        logger.info("plugin-registry", "Plugin directory changed, reloading...");
        await loadAllPlugins();
      }, 3000);
    });

    if (fileWatcher.unref) fileWatcher.unref();
  } catch {
    logger.warn("plugin-registry", "Failed to watch plugins directory");
  }
}

// ============================================
// REGISTRY PERSISTENCE
// ============================================

function loadRegistryStates(): Record<string, boolean> {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
      const states: Record<string, boolean> = {};
      for (const entry of data) {
        states[entry.id] = entry.enabled;
      }
      return states;
    }
  } catch { }
  return {};
}

function saveRegistryStates(): void {
  try {
    ensureDirs();
    const data = Array.from(plugins.entries()).map(([id, p]) => ({
      id,
      enabled: p.enabled,
      source: p.source,
    }));
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch { }
}

// ============================================
// UTILITIES
// ============================================

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Stop file watcher. Call on shutdown.
 */
export function stopPluginWatcher(): void {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
}
