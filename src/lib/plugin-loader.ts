/**
 * Karya Plugin System — OpenClaw-style Skill Packs
 * 
 * Skills are specialized instruction sets that give Karya domain knowledge.
 * Each skill is a folder with:
 * - SKILL.md — Instructions for the agent
 * - _meta.json — Metadata (optional)
 * - scripts/ — Helper scripts (optional)
 * - references/ — Reference docs (optional)
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

// Skill directory
const SKILLS_DIR = path.join(process.cwd(), "workspace", "skills");

// Skill metadata interface
export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  path: string;
  hasScripts: boolean;
  hasReferences: boolean;
  loaded?: boolean;
}

// Skill content interface
export interface Skill extends SkillMeta {
  content: string;
  frontmatter: Record<string, any>;
}

// Cache for loaded skills
const skillCache: Map<string, Skill> = new Map();

/**
 * Ensure skills directory exists
 */
export function ensureSkillsDir(): void {
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }
}

/**
 * List all available skills
 */
export function listSkills(): SkillMeta[] {
  ensureSkillsDir();
  
  const skills: SkillMeta[] = [];
  
  try {
    const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      
      const skillPath = path.join(SKILLS_DIR, dir.name);
      const skillFile = path.join(skillPath, "SKILL.md");
      
      if (!fs.existsSync(skillFile)) continue;
      
      try {
        const content = fs.readFileSync(skillFile, "utf-8");
        const { data } = matter(content);
        
        skills.push({
          id: dir.name,
          name: data.name || dir.name,
          description: data.description || "",
          triggers: parseTriggers(data.triggers),
          path: skillPath,
          hasScripts: fs.existsSync(path.join(skillPath, "scripts")),
          hasReferences: fs.existsSync(path.join(skillPath, "references")),
        });
      } catch {
        // Skip invalid skills
        continue;
      }
    }
  } catch {
    // Return empty if can't read directory
  }
  
  return skills;
}

/**
 * Parse triggers from various formats
 */
function parseTriggers(triggers: any): string[] {
  if (!triggers) return [];
  if (Array.isArray(triggers)) return triggers;
  if (typeof triggers === "string") {
    return triggers.split(",").map((t) => t.trim().toLowerCase());
  }
  return [];
}

/**
 * Find skills matching a query
 */
export function matchSkills(query: string): SkillMeta[] {
  const skills = listSkills();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);
  
  const scored: { skill: SkillMeta; score: number }[] = [];
  
  for (const skill of skills) {
    let score = 0;
    
    // Check triggers
    for (const trigger of skill.triggers) {
      if (queryLower.includes(trigger)) {
        score += 10; // High score for trigger match
      }
      for (const word of queryWords) {
        if (trigger.includes(word) || word.includes(trigger)) {
          score += 5;
        }
      }
    }
    
    // Check name
    if (queryLower.includes(skill.name.toLowerCase())) {
      score += 8;
    }
    
    // Check description
    const descLower = skill.description.toLowerCase();
    for (const word of queryWords) {
      if (descLower.includes(word)) {
        score += 2;
      }
    }
    
    if (score > 0) {
      scored.push({ skill, score });
    }
  }
  
  // Sort by score and return top matches
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.skill);
}

/**
 * Load a skill by ID
 */
export function loadSkill(skillId: string): Skill | null {
  // Check cache first
  if (skillCache.has(skillId)) {
    return skillCache.get(skillId)!;
  }
  
  const skillPath = path.join(SKILLS_DIR, skillId);
  const skillFile = path.join(skillPath, "SKILL.md");
  
  if (!fs.existsSync(skillFile)) {
    return null;
  }
  
  try {
    const raw = fs.readFileSync(skillFile, "utf-8");
    const { data, content } = matter(raw);
    
    const skill: Skill = {
      id: skillId,
      name: data.name || skillId,
      description: data.description || "",
      triggers: parseTriggers(data.triggers),
      path: skillPath,
      hasScripts: fs.existsSync(path.join(skillPath, "scripts")),
      hasReferences: fs.existsSync(path.join(skillPath, "references")),
      content: content.trim(),
      frontmatter: data,
      loaded: true,
    };
    
    // Cache it
    skillCache.set(skillId, skill);
    
    return skill;
  } catch {
    return null;
  }
}

/**
 * Create a new skill
 */
export function createSkill(
  id: string,
  name: string,
  description: string,
  triggers: string[],
  content: string
): boolean {
  ensureSkillsDir();
  
  const skillPath = path.join(SKILLS_DIR, id);
  
  // Don't overwrite existing
  if (fs.existsSync(skillPath)) {
    return false;
  }
  
  try {
    // Create skill directory
    fs.mkdirSync(skillPath, { recursive: true });
    
    // Build SKILL.md with frontmatter
    const frontmatter = [
      "---",
      `name: ${name}`,
      `description: ${description}`,
      `triggers: ${triggers.join(", ")}`,
      "---",
      "",
    ].join("\n");
    
    const skillFile = path.join(skillPath, "SKILL.md");
    fs.writeFileSync(skillFile, frontmatter + content, "utf-8");
    
    // Clear cache
    skillCache.delete(id);
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Get skill's reference files
 */
export function getSkillReferences(skillId: string): string[] {
  const skillPath = path.join(SKILLS_DIR, skillId, "references");
  
  if (!fs.existsSync(skillPath)) {
    return [];
  }
  
  try {
    return fs.readdirSync(skillPath).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
}

/**
 * Read a skill's reference file
 */
export function readSkillReference(skillId: string, refFile: string): string {
  const refPath = path.join(SKILLS_DIR, skillId, "references", refFile);
  
  if (!fs.existsSync(refPath)) {
    return "";
  }
  
  try {
    return fs.readFileSync(refPath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Get skill's scripts
 */
export function getSkillScripts(skillId: string): string[] {
  const skillPath = path.join(SKILLS_DIR, skillId, "scripts");
  
  if (!fs.existsSync(skillPath)) {
    return [];
  }
  
  try {
    return fs.readdirSync(skillPath);
  } catch {
    return [];
  }
}
