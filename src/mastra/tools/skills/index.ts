/**
 * Skill Tools — Let agent discover and use skills
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { matchSkills, loadSkill, listSkills, createSkill, getSkillCatalogContext } from "@/lib/skill-engine";

/**
 * List all available skills
 */
export const skillListTool = createTool({
  id: "skill-list",
  description: "List all available skills in the workspace. Use this to see what specialized capabilities are available.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    skills: z.array(z.object({
      name: z.string(),
      description: z.string(),
      triggers: z.array(z.string()),
    })),
    count: z.number(),
  }),
  execute: async () => {
    const skills = listSkills();
    return {
      skills: skills.map((s) => ({
        name: s.name,
        description: s.description,
        triggers: s.triggers,
      })),
      count: skills.length,
    };
  },
});

/**
 * Match skills to a query
 */
export const skillMatchTool = createTool({
  id: "skill-match",
  description: "Find skills that match a user's request. Returns matching skills based on trigger keywords.",
  inputSchema: z.object({
    query: z.string().describe("The user's request/query to match against skills"),
  }),
  outputSchema: z.object({
    matches: z.array(z.object({
      name: z.string(),
      description: z.string(),
    })),
    count: z.number(),
  }),
  execute: async ({ query }) => {
    const matches = matchSkills(query);
    return {
      matches: matches.map((s) => ({
        name: s.name,
        description: s.description,
      })),
      count: matches.length,
    };
  },
});

/**
 * Load a skill's instructions
 */
export const skillLoadTool = createTool({
  id: "skill-load",
  description: 
    "Load a skill's SKILL.md instructions. Use this when you need specialized guidance for a task. " +
    "The skill content will give you step-by-step instructions for that domain.",
  inputSchema: z.object({
    skillName: z.string().describe("Name of the skill to load (e.g., 'github', 'weather')"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    skillName: z.string(),
    content: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ skillName }) => {
    const content = loadSkill(skillName);
    if (!content) {
      return {
        success: false,
        skillName,
        content: "",
        error: `Skill '${skillName}' not found`,
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
 * Create a new skill
 */
export const skillCreateTool = createTool({
  id: "skill-create",
  description: 
    "Create a new skill with custom instructions. Use this to add specialized capabilities. " +
    "Skills are stored in workspace/skills/<name>/SKILL.md",
  inputSchema: z.object({
    name: z.string().describe("Skill name (lowercase, no spaces, e.g., 'github', 'weather')"),
    description: z.string().describe("Short description of what the skill does"),
    triggers: z.array(z.string()).describe("Keywords that activate this skill"),
    instructions: z.string().describe("Detailed instructions for handling this skill's tasks"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    skillName: z.string(),
    path: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ name, description, triggers, instructions }) => {
    const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const success = createSkill(safeName, description, triggers, instructions);
    
    if (!success) {
      return {
        success: false,
        skillName: safeName,
        path: "",
        error: "Failed to create skill",
      };
    }
    
    return {
      success: true,
      skillName: safeName,
      path: `workspace/skills/${safeName}/SKILL.md`,
    };
  },
});

// Export skill context getter for chat route
export { getSkillCatalogContext };
