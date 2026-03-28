/**
 * Karya Plugin Tools — Agent can manage plugins
 * 
 * - "Create a new plugin called google-calendar"
 * - "List all installed plugins"
 * - "Install plugin from D:\my-plugins\weather"
 * - "Disable the twitter plugin"
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  listInstalledPlugins,
  installFromPath,
  uninstallPlugin,
  scaffoldPlugin,
  togglePluginEnabled,
  getPluginRegistryStats,
} from "../../../lib/plugin-registry";

// ============================================
// plugin-list
// ============================================

export const pluginListTool = createTool({
  id: "plugin-list",
  description: "List all installed plugins with their status, tools, and skills",
  inputSchema: z.object({}),
  execute: async () => {
    const plugins = listInstalledPlugins();
    const stats = getPluginRegistryStats();

    return {
      plugins: plugins.map((p) => ({
        id: p.id,
        name: p.manifest.name,
        version: p.manifest.version,
        description: p.manifest.description,
        enabled: p.enabled,
        hasSkill: p.hasSkill,
        triggers: p.triggers,
        source: p.source,
        error: p.loadError || undefined,
      })),
      stats,
    };
  },
});

// ============================================
// plugin-create
// ============================================

export const pluginCreateTool = createTool({
  id: "plugin-create",
  description: `Create a new plugin scaffold in workspace/plugins/. 
Generates plugin.json, SKILL.md, and optionally tools.ts.
The user can then customize the files.`,
  inputSchema: z.object({
    name: z.string().describe("Plugin name (e.g., 'Google Calendar', 'Notion')"),
    description: z.string().optional().describe("What this plugin does"),
    withTools: z.boolean().optional().describe("Generate a tools.ts template (default: false)"),
  }),
  execute: async (input) => {
    const result = scaffoldPlugin(
      input.name,
      input.description || "",
      { triggers: input.withTools ? [input.name.toLowerCase()] : undefined }
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      path: result.path,
      files: ["plugin.json", "SKILL.md", "README.md", ...(input.withTools ? ["tools.ts"] : [])],
      message: `Plugin "${input.name}" created. Edit the files in ${result.path} to customize.`,
    };
  },
});

// ============================================
// plugin-install
// ============================================

export const pluginInstallTool = createTool({
  id: "plugin-install",
  description: "Install a plugin from a local directory path. Copies the plugin into workspace/plugins/.",
  inputSchema: z.object({
    path: z.string().describe("Path to the plugin directory to install"),
  }),
  execute: async (input) => {
    const result = await installFromPath(input.path);
    return {
      success: result.success,
      pluginId: result.pluginId,
      error: result.error,
    };
  },
});

// ============================================
// plugin-toggle
// ============================================

export const pluginToggleTool = createTool({
  id: "plugin-toggle",
  description: "Enable or disable a plugin by its ID",
  inputSchema: z.object({
    id: z.string().describe("Plugin ID"),
    enabled: z.boolean().optional().describe("true to enable, false to disable. Omit to toggle."),
  }),
  execute: async (input) => {
    const success = togglePluginEnabled(input.id, input.enabled);
    return {
      success,
      message: success ? `Plugin ${input.id} toggled` : `Plugin ${input.id} not found`,
    };
  },
});

// ============================================
// plugin-uninstall
// ============================================

export const pluginUninstallTool = createTool({
  id: "plugin-uninstall",
  requireApproval: true,
  description: "Uninstall a plugin — removes it from disk completely",
  inputSchema: z.object({
    id: z.string().describe("Plugin ID to uninstall"),
  }),
  execute: async (input) => {
    const result = uninstallPlugin(input.id);
    return {
      success: result.success,
      error: result.error,
    };
  },
});
