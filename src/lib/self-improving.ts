/**
 * Karya Self-Improving Agent
 * 
 * After every significant task:
 * 1. Agent reviews its own output
 * 2. Identifies what went well / what failed
 * 3. Writes lessons to workspace/lessons.md
 * 4. Before new tasks, loads relevant lessons
 * 
 * Over time, the agent genuinely improves.
 */

import { generateText } from "ai";
import { getModel } from "./llm";
import { getMemoryManager } from "./memory-v2";
import { logger } from "./logger";
import * as fs from "fs";
import * as path from "path";

const LESSONS_FILE = "lessons.md";
const MAX_LESSONS = 50;

export interface Lesson {
  id: string;
  timestamp: number;
  task: string;
  outcome: "success" | "partial" | "failure";
  whatWorked: string[];
  whatFailed: string[];
  improvement: string;
  tags: string[];
}

export interface ReviewResult {
  outcome: "success" | "partial" | "failure";
  quality: number; // 1-10
  whatWorked: string[];
  whatFailed: string[];
  improvement: string;
  shouldLearn: boolean;
}

/**
 * Review agent's own output after a task
 */
export async function reviewOutput(
  task: string,
  output: string,
  toolsUsed: string[]
): Promise<ReviewResult> {
  const prompt = `You are reviewing your own output. Be honest and critical.

TASK: ${task}

YOUR OUTPUT:
${output.slice(0, 2000)}

TOOLS USED: ${toolsUsed.join(", ") || "none"}

Evaluate your performance:

1. OUTCOME: Did you complete the task successfully?
   - success: Task fully completed
   - partial: Some parts done, some missing
   - failure: Task not completed or wrong result

2. QUALITY (1-10): How good was your output?

3. WHAT WORKED WELL: (list 1-3 things)

4. WHAT COULD BE BETTER: (list 1-3 things)

5. IMPROVEMENT: One specific lesson for next time.

6. SHOULD LEARN: Is this lesson worth remembering? (yes/no)

Respond in JSON:
{
  "outcome": "success|partial|failure",
  "quality": 7,
  "whatWorked": ["clear explanation", "good examples"],
  "whatFailed": ["could be more concise"],
  "improvement": "Next time, start with a summary before diving into details",
  "shouldLearn": true
}`;

  try {
    const llm = getModel();
    const result = await generateText({
      model: llm,
      prompt,
    });

    // Parse JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON in response");
    }

    const review = JSON.parse(jsonMatch[0]) as ReviewResult;
    return review;

  } catch (err) {
    logger.warn("self-improving", "Failed to parse review, using defaults", err);
    return {
      outcome: "partial",
      quality: 5,
      whatWorked: [],
      whatFailed: [],
      improvement: "",
      shouldLearn: false,
    };
  }
}

/**
 * Save a lesson to lessons.md
 */
export async function saveLesson(
  task: string,
  review: ReviewResult,
  tags: string[] = []
): Promise<void> {
  if (!review.shouldLearn || !review.improvement) {
    return;
  }

  const memory = getMemoryManager();
  const workspacePath = path.join(process.cwd(), "workspace");
  const lessonsPath = path.join(workspacePath, LESSONS_FILE);

  const lesson: Lesson = {
    id: `lesson-${Date.now()}`,
    timestamp: Date.now(),
    task: task.slice(0, 200),
    outcome: review.outcome,
    whatWorked: review.whatWorked,
    whatFailed: review.whatFailed,
    improvement: review.improvement,
    tags,
  };

  // Format lesson
  const date = new Date().toISOString().split("T")[0];
  const lessonMd = `
## ${date} — ${lesson.outcome.toUpperCase()}

**Task:** ${lesson.task}

**What worked:**
${lesson.whatWorked.map(w => `- ${w}`).join("\n") || "- (none noted)"}

**What could be better:**
${lesson.whatFailed.map(f => `- ${f}`).join("\n") || "- (none noted)"}

**Lesson learned:**
> ${lesson.improvement}

**Tags:** ${lesson.tags.join(", ") || "general"}

---
`;

  // Append to lessons file
  let content = "";
  if (fs.existsSync(lessonsPath)) {
    content = fs.readFileSync(lessonsPath, "utf-8");
  } else {
    content = `# Lessons Learned

This file contains lessons from past tasks. Review before starting similar work.

---
`;
  }

  content += lessonMd;
  fs.writeFileSync(lessonsPath, content, "utf-8");

  logger.info("self-improving", `Saved lesson: ${lesson.improvement.slice(0, 50)}...`);
}

/**
 * Load relevant lessons for a new task
 */
export async function loadRelevantLessons(
  task: string,
  maxLessons: number = 5
): Promise<string> {
  const memory = getMemoryManager();
  
  // Search for relevant lessons
  const results = await memory.search(task, { maxResults: maxLessons });
  
  if (results.length === 0) {
    return "";
  }

  // Format lessons for context
  const lessons = results
    .filter(r => r.entry.source === LESSONS_FILE)
    .map(r => r.snippet)
    .join("\n\n");

  if (!lessons) {
    return "";
  }

  return `## Relevant Lessons from Past Tasks

${lessons}

---

Apply these lessons to the current task.`;
}

/**
 * Get lessons stats
 */
export function getLessonsStats(): { total: number; success: number; failure: number } {
  const workspacePath = path.join(process.cwd(), "workspace");
  const lessonsPath = path.join(workspacePath, LESSONS_FILE);

  if (!fs.existsSync(lessonsPath)) {
    return { total: 0, success: 0, failure: 0 };
  }

  const content = fs.readFileSync(lessonsPath, "utf-8");
  const successCount = (content.match(/— SUCCESS/g) || []).length;
  const failureCount = (content.match(/— FAILURE/g) || []).length;
  const partialCount = (content.match(/— PARTIAL/g) || []).length;

  return {
    total: successCount + failureCount + partialCount,
    success: successCount,
    failure: failureCount,
  };
}

/**
 * Self-improvement cycle — call after significant tasks
 */
export async function selfImprove(
  task: string,
  output: string,
  toolsUsed: string[],
  tags: string[] = []
): Promise<{ reviewed: boolean; lessonSaved: boolean }> {
  try {
    // Step 1: Review output
    const review = await reviewOutput(task, output, toolsUsed);
    
    // Step 2: Save lesson if worthwhile
    if (review.shouldLearn) {
      await saveLesson(task, review, tags);
      return { reviewed: true, lessonSaved: true };
    }
    
    return { reviewed: true, lessonSaved: false };
  } catch (err) {
    logger.error("self-improving", "Self-improvement cycle failed", err);
    return { reviewed: false, lessonSaved: false };
  }
}
