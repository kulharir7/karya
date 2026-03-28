/**
 * Karya Self-Improving Loop — Agent learns from its own performance
 * 
 * REWRITTEN in Phase 5.5 to actually connect to ChatProcessor:
 * 
 * Flow:
 *   1. ChatProcessor completes a task (onDone fires)
 *   2. If task used tools → worth reviewing
 *   3. LLM reviews its own output (separate call, cheap/fast)
 *   4. If lesson worth learning → append to workspace/lessons.md
 *   5. Before next task → relevant lessons injected into context
 *   6. Quality score tracked in workspace/quality-stats.json
 * 
 * Integration points:
 *   - Post-task: call runSelfReview() after ChatProcessor finishes
 *   - Pre-task: call getRelevantLessons() before building context
 *   - Stats: getLessonsStats() + getQualityStats() for dashboard
 * 
 * This is ASYNC and NON-BLOCKING — it runs after the response is sent.
 * User never waits for self-review.
 */

import { generateText } from "ai";
import { getModelForAgent } from "./model-router";
import { logger } from "./logger";
import { eventBus } from "./event-bus";
import * as fs from "fs";
import * as path from "path";

// ============================================
// TYPES
// ============================================

export interface ReviewResult {
  outcome: "success" | "partial" | "failure";
  quality: number; // 1-10
  whatWorked: string[];
  whatFailed: string[];
  lesson: string;
  shouldLearn: boolean;
}

export interface QualityEntry {
  timestamp: number;
  task: string;
  quality: number;
  outcome: string;
  toolCount: number;
  durationMs: number;
}

// ============================================
// CONSTANTS
// ============================================

const WORKSPACE = path.join(process.cwd(), "workspace");
const LESSONS_FILE = path.join(WORKSPACE, "lessons.md");
const STATS_FILE = path.join(WORKSPACE, "quality-stats.json");

/** Minimum tool count to trigger self-review (skip trivial tasks) */
const MIN_TOOLS_FOR_REVIEW = 1;

/** Max lessons to keep in file (prune oldest when exceeded) */
const MAX_LESSONS = 100;

/** Max characters of output to review (save tokens) */
const MAX_REVIEW_OUTPUT = 1500;

/** Only review tasks longer than this (skip instant responses) */
const MIN_DURATION_FOR_REVIEW_MS = 2000;

/** Whether self-review is enabled */
let enabled = true;

// ============================================
// MAIN: POST-TASK REVIEW
// ============================================

/**
 * Run self-review after a task completes.
 * Call this from ChatProcessor's post-processing.
 * 
 * This is ASYNC and fire-and-forget — it doesn't block the response.
 * 
 * @param task - The user's original message
 * @param output - The agent's response text
 * @param toolsUsed - List of tool names that were called
 * @param durationMs - How long the task took
 */
export async function runSelfReview(
  task: string,
  output: string,
  toolsUsed: string[],
  durationMs: number
): Promise<void> {
  if (!enabled) return;

  // Skip trivial tasks
  if (toolsUsed.length < MIN_TOOLS_FOR_REVIEW) return;
  if (durationMs < MIN_DURATION_FOR_REVIEW_MS) return;
  if (!output || output.length < 20) return;

  try {
    // Step 1: LLM reviews its own output
    const review = await reviewOutput(task, output, toolsUsed);

    // Step 2: Track quality score
    trackQuality({
      timestamp: Date.now(),
      task: task.slice(0, 200),
      quality: review.quality,
      outcome: review.outcome,
      toolCount: toolsUsed.length,
      durationMs,
    });

    // Step 3: Save lesson if worthwhile
    if (review.shouldLearn && review.lesson) {
      saveLesson(task, review, toolsUsed);
      logger.info("self-improving", `Lesson saved: "${review.lesson.slice(0, 60)}..."`);
    }

    // Step 4: Emit event
    await eventBus.emit("custom:self-review", {
      quality: review.quality,
      outcome: review.outcome,
      lessonSaved: review.shouldLearn,
    });

  } catch (err: any) {
    // Self-review failure should NEVER affect the user
    logger.debug("self-improving", `Review failed (non-critical): ${err.message}`);
  }
}

// ============================================
// LLM REVIEW
// ============================================

async function reviewOutput(
  task: string,
  output: string,
  toolsUsed: string[]
): Promise<ReviewResult> {
  const truncatedOutput = output.slice(0, MAX_REVIEW_OUTPUT);

  const prompt = `You are reviewing your own performance on a task. Be honest, brief, and constructive.

TASK: ${task.slice(0, 500)}
TOOLS USED: ${toolsUsed.join(", ")}
YOUR OUTPUT (truncated): ${truncatedOutput}

Rate yourself:
1. outcome: "success" | "partial" | "failure"
2. quality: 1-10
3. whatWorked: 1-2 brief points
4. whatFailed: 1-2 brief points (or empty if perfect)
5. lesson: ONE specific actionable lesson for next time (or empty if nothing to learn)
6. shouldLearn: true only if the lesson is genuinely useful for future tasks

Respond ONLY with valid JSON, no other text:
{"outcome":"success","quality":8,"whatWorked":["x"],"whatFailed":["y"],"lesson":"z","shouldLearn":true}`;

  try {
    const llm = getModelForAgent();
    const result = await generateText({
      model: llm as any,
      prompt,
      maxOutputTokens: 300,
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return defaultReview();
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      outcome: parsed.outcome || "partial",
      quality: Math.min(10, Math.max(1, parseInt(parsed.quality) || 5)),
      whatWorked: Array.isArray(parsed.whatWorked) ? parsed.whatWorked.slice(0, 3) : [],
      whatFailed: Array.isArray(parsed.whatFailed) ? parsed.whatFailed.slice(0, 3) : [],
      lesson: typeof parsed.lesson === "string" ? parsed.lesson : "",
      shouldLearn: !!parsed.shouldLearn,
    };
  } catch {
    return defaultReview();
  }
}

function defaultReview(): ReviewResult {
  return {
    outcome: "partial",
    quality: 5,
    whatWorked: [],
    whatFailed: [],
    lesson: "",
    shouldLearn: false,
  };
}

// ============================================
// LESSON STORAGE
// ============================================

function saveLesson(task: string, review: ReviewResult, toolsUsed: string[]): void {
  try {
    const date = new Date().toISOString().split("T")[0];
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const lessonBlock = `
### ${date} ${time} — ${review.outcome.toUpperCase()} (${review.quality}/10)
- **Task:** ${task.slice(0, 150)}
- **Tools:** ${toolsUsed.join(", ")}
${review.whatWorked.length > 0 ? `- **Worked:** ${review.whatWorked.join("; ")}` : ""}
${review.whatFailed.length > 0 ? `- **Improve:** ${review.whatFailed.join("; ")}` : ""}
- **💡 Lesson:** ${review.lesson}

---
`;

    let content = "";
    if (fs.existsSync(LESSONS_FILE)) {
      content = fs.readFileSync(LESSONS_FILE, "utf-8");
    } else {
      content = `# Karya — Lessons Learned

This file is auto-generated. The agent reviews its own output after each significant task
and writes down lessons to improve over time.

---
`;
    }

    content += lessonBlock;

    // Prune if too many lessons
    const sections = content.split(/^---$/m);
    if (sections.length > MAX_LESSONS + 2) {
      // Keep header + last MAX_LESSONS sections
      const header = sections.slice(0, 2).join("---");
      const recent = sections.slice(-(MAX_LESSONS)).join("---");
      content = header + "---" + recent;
    }

    fs.writeFileSync(LESSONS_FILE, content, "utf-8");
  } catch (err: any) {
    logger.debug("self-improving", `Failed to save lesson: ${err.message}`);
  }
}

// ============================================
// PRE-TASK: LOAD RELEVANT LESSONS
// ============================================

/**
 * Search lessons file for relevant past lessons.
 * Returns a formatted string to inject into agent context.
 * 
 * Call this before building the context for a new task.
 * Uses simple text search (no vectors needed — lessons are short).
 */
export function getRelevantLessons(task: string, maxResults: number = 3): string {
  if (!fs.existsSync(LESSONS_FILE)) return "";

  try {
    const content = fs.readFileSync(LESSONS_FILE, "utf-8");
    const sections = content.split(/^---$/m).filter((s) => s.includes("**💡 Lesson:**"));

    if (sections.length === 0) return "";

    // Simple keyword matching (fast, no LLM call)
    const taskWords = task.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const scored = sections.map((section) => {
      const lower = section.toLowerCase();
      let score = 0;
      for (const word of taskWords) {
        if (lower.includes(word)) score++;
      }
      return { section, score };
    });

    const relevant = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((s) => s.section.trim());

    if (relevant.length === 0) return "";

    return `\n## 💡 Relevant Lessons from Past Tasks\n\n${relevant.join("\n\n---\n\n")}\n\nApply these lessons to improve your response.\n`;
  } catch {
    return "";
  }
}

// ============================================
// QUALITY TRACKING
// ============================================

function trackQuality(entry: QualityEntry): void {
  try {
    let stats: QualityEntry[] = [];

    if (fs.existsSync(STATS_FILE)) {
      const content = fs.readFileSync(STATS_FILE, "utf-8");
      stats = JSON.parse(content);
    }

    stats.push(entry);

    // Keep last 500 entries
    if (stats.length > 500) {
      stats = stats.slice(-500);
    }

    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf-8");
  } catch {
    // Non-critical
  }
}

/**
 * Get quality statistics.
 */
export function getQualityStats(): {
  totalReviews: number;
  averageQuality: number;
  successRate: number;
  recentTrend: "improving" | "stable" | "declining" | "insufficient_data";
  lessonCount: number;
} {
  // Quality stats
  let stats: QualityEntry[] = [];
  try {
    if (fs.existsSync(STATS_FILE)) {
      stats = JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
    }
  } catch {
    stats = [];
  }

  const totalReviews = stats.length;
  const averageQuality = totalReviews > 0
    ? Math.round((stats.reduce((s, e) => s + e.quality, 0) / totalReviews) * 10) / 10
    : 0;
  const successRate = totalReviews > 0
    ? Math.round((stats.filter((e) => e.outcome === "success").length / totalReviews) * 100)
    : 0;

  // Trend: compare last 10 to previous 10
  let recentTrend: "improving" | "stable" | "declining" | "insufficient_data" = "insufficient_data";
  if (stats.length >= 20) {
    const recent10 = stats.slice(-10);
    const prev10 = stats.slice(-20, -10);
    const recentAvg = recent10.reduce((s, e) => s + e.quality, 0) / 10;
    const prevAvg = prev10.reduce((s, e) => s + e.quality, 0) / 10;
    const diff = recentAvg - prevAvg;
    if (diff > 0.5) recentTrend = "improving";
    else if (diff < -0.5) recentTrend = "declining";
    else recentTrend = "stable";
  }

  // Lesson count
  let lessonCount = 0;
  try {
    if (fs.existsSync(LESSONS_FILE)) {
      const content = fs.readFileSync(LESSONS_FILE, "utf-8");
      lessonCount = (content.match(/\*\*💡 Lesson:\*\*/g) || []).length;
    }
  } catch {
    lessonCount = 0;
  }

  return {
    totalReviews,
    averageQuality,
    successRate,
    recentTrend,
    lessonCount,
  };
}

// ============================================
// CONTROL
// ============================================

/**
 * Enable or disable self-review.
 */
export function setSelfImproveEnabled(value: boolean): void {
  enabled = value;
  logger.info("self-improving", `Self-review ${value ? "enabled" : "disabled"}`);
}

export function isSelfImproveEnabled(): boolean {
  return enabled;
}
