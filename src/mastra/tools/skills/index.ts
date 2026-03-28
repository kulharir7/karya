/**
 * Skill Tools — Agent can discover and load plugin/skill instructions
 * 
 * NOW UNIFIED with plugin-registry (Phase 6 deep rewrite):
 * - skill-list reads from plugin-registry (not separate skill-engine)
 * - skill-match uses plugin-registry matching (triggers + description + content)
 * - skill-load reads from plugin-registry (plugins/ + legacy skills/)
 * - skill-create uses plugin-registry scaffold
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  listInstalledPlugins,
  matchPlugins,
  loadPluginSkill,
  scaffoldPlugin,
} from "../../../lib/plugin-registry";

/**
 * List all available skills/plugins
 */
export const skillListTool = createTool({
  id: "skill-list",
  description: "List all available plugins and skills. Shows name, description, triggers, and enabled status.",
  inputSchema: z.object({}),
  execute: async () => {
    const plugins = listInstalledPlugins();
    return {
      plugins: plugins.map((p) => ({
        name: p.manifest.name || p.id,
        description: p.manifest.description || "",
        triggers: p.triggers,
        enabled: p.enabled,
        hasSkill: p.hasSkill,
        source: p.source,
        error: p.loadError || undefined,
      })),
      count: plugins.length,
      enabled: plugins.filter((p) => p.enabled).length,
    };
  },
});

/**
 * Match plugins/skills to a query
 */
export const skillMatchTool = createTool({
  id: "skill-match",
  description: "Find plugins matching a user's request. Uses trigger keywords, name, and description matching.",
  inputSchema: z.object({
    query: z.string().describe("The user's request to match against plugin triggers"),
  }),
  execute: async ({ query }) => {
    const matches = matchPlugins(query);
    return {
      matches: matches.map((p) => ({
        id: p.id,
        name: p.manifest.name || p.id,
        description: p.manifest.description || "",
        triggers: p.triggers,
      })),
      count: matches.length,
    };
  },
});

/**
 * Load a plugin's full SKILL.md instructions
 */
export const skillLoadTool = createTool({
  id: "skill-load",
  description:
    "Load a plugin's full SKILL.md instructions. Use this when you need detailed guidance for a specific domain. " +
    "The instructions tell you exactly how to handle tasks for that plugin.",
  inputSchema: z.object({
    skillName: z.string().describe("Plugin/skill ID to load (e.g., 'github', 'weather', 'calculator')"),
  }),
  execute: async ({ skillName }) => {
    const content = loadPluginSkill(skillName);
    if (!content) {
      return {
        success: false,
        skillName,
        content: "",
        error: `Plugin/skill '${skillName}' not found`,
      };
    }
    return {
      success: true,
      skillName,
      content,
    };
  },
});

/**
 * Create a new plugin/skill
 */
export const skillCreateTool = createTool({
  id: "skill-create",
  description:
    "Create a new plugin with SKILL.md instructions. Generates plugin.json + SKILL.md + README.md " +
    "in workspace/plugins/<name>/. The user can customize the files after creation.",
  inputSchema: z.object({
    name: z.string().describe("Plugin name (e.g., 'google-calendar', 'notion')"),
    description: z.string().describe("What this plugin does"),
    triggers: z.array(z.string()).describe("Keywords that activate this plugin"),
    instructions: z.string().optional().describe("Initial SKILL.md content (agent instructions)"),
  }),
  execute: async ({ name, description, triggers, instructions }) => {
    const result = scaffoldPlugin(name, description, { triggers });

    if (!result.success) {
      return { success: false, error: result.error, path: "" };
    }

    // If custom instructions provided, overwrite the generated SKILL.md
    if (instructions && result.path) {
      const fs = await import("fs");
      const path = await import("path");
      const skillPath = path.join(result.path, "SKILL.md");
      const triggerStr = triggers.join(", ");
      const content = `---
name: ${name}
description: ${description}
triggers: ${triggerStr}
---

${instructions}
`;
      fs.writeFileSync(skillPath, content, "utf-8");
    }

    return {
      success: true,
      path: result.path,
      files: ["plugin.json", "SKILL.md", "README.md"],
    };
  },
});

// Re-export for backward compatibility
export function getSkillCatalogContext(): string {
  const { getActivePluginSkills } = require("../../../lib/plugin-registry");
  return getActivePluginSkills();
}
