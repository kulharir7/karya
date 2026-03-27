/**
 * Skill Engine — OpenClaw-style dynamic skill loading
 * 
 * Skills are stored in workspace/skills/<skill-name>/SKILL.md
 * Each skill has instructions for handling specific domains (github, weather, discord, etc.)
 * 
 * Agent checks task against skill catalog and loads relevant SKILL.md dynamically.
 */

import * as fs from "fs";
import * as path from "path";

const SKILLS_DIR = path.join(process.cwd(), "workspace", "skills");

export interface Skill {
  name: string;
  path: string;
  description: string;
  triggers: string[];  // Keywords/phrases that activate this skill
}

export interface SkillCatalog {
  skills: Skill[];
  lastUpdated: number;
}

// Cache skill catalog (refresh every 60s)
let skillCache: SkillCatalog | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

/**
 * Parse SKILL.md frontmatter to extract metadata
 * Format:
 * ---
 * name: GitHub
 * description: GitHub operations - repos, issues, PRs
 * triggers: github, repo, repository, pull request, PR, issue, commit
 * ---
 */
function parseSkillFrontmatter(content: string): { description: string; triggers: string[] } {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    // No frontmatter — use first line as description
    const firstLine = content.split("\n")[0].replace(/^#\s*/, "").trim();
    return {
      description: firstLine || "No description",
      triggers: [],
    };
  }

  const frontmatter = frontmatterMatch[1];
  const description = frontmatter.match(/description:\s*(.+)/i)?.[1]?.trim() || "No description";
  const triggersLine = frontmatter.match(/triggers:\s*(.+)/i)?.[1]?.trim() || "";
  const triggers = triggersLine.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

  return { description, triggers };
}

/**
 * Scan skills directory and build catalog
 */
export function scanSkills(): SkillCatalog {
  const now = Date.now();
  if (skillCache && now - cacheTime < CACHE_TTL) {
    return skillCache;
  }

  const skills: Skill[] = [];

  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(SKILLS_DIR, entry.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;

    try {
      const content = fs.readFileSync(skillPath, "utf-8");
      const { description, triggers } = parseSkillFrontmatter(content);

      skills.push({
        name: entry.name,
        path: skillPath,
        description,
        triggers: triggers.length > 0 ? triggers : [entry.name.toLowerCase()],
      });
    } catch {
      // Skip invalid skills
    }
  }

  skillCache = { skills, lastUpdated: now };
  cacheTime = now;
  return skillCache;
}

/**
 * Find skills that match a user query
 */
export function matchSkills(query: string): Skill[] {
  const catalog = scanSkills();
  const queryLower = query.toLowerCase();
  const matched: Skill[] = [];

  for (const skill of catalog.skills) {
    // Check if any trigger word appears in query
    const isMatch = skill.triggers.some((trigger) => queryLower.includes(trigger));
    if (isMatch) {
      matched.push(skill);
    }
  }

  return matched;
}

/**
 * Load a skill's SKILL.md content
 */
export function loadSkill(skillName: string): string | null {
  const skillPath = path.join(SKILLS_DIR, skillName, "SKILL.md");
  if (!fs.existsSync(skillPath)) return null;

  try {
    return fs.readFileSync(skillPath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Get skill catalog for agent context injection
 */
export function getSkillCatalogContext(): string {
  const catalog = scanSkills();
  if (catalog.skills.length === 0) {
    return "";
  }

  const lines = [
    "## Available Skills",
    "When a task matches a skill, load its SKILL.md using the skill-load tool.",
    "",
  ];

  for (const skill of catalog.skills) {
    lines.push(`- **${skill.name}**: ${skill.description}`);
    lines.push(`  Triggers: ${skill.triggers.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Create a new skill
 */
export function createSkill(name: string, description: string, triggers: string[], instructions: string): boolean {
  const skillDir = path.join(SKILLS_DIR, name);
  const skillPath = path.join(skillDir, "SKILL.md");

  try {
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }

    const content = `---
name: ${name}
description: ${description}
triggers: ${triggers.join(", ")}
---

# ${name} Skill

${instructions}
`;

    fs.writeFileSync(skillPath, content, "utf-8");
    
    // Invalidate cache
    skillCache = null;
    return true;
  } catch {
    return false;
  }
}

/**
 * List all skills (for UI/API)
 */
export function listSkills(): Skill[] {
  return scanSkills().skills;
}
