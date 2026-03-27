/**
 * Karya Workflow Engine
 * 
 * OpenClaw-level workflow management with:
 * - Workflow persistence (LibSQL)
 * - Suspend/Resume support
 * - Real-time status tracking
 * - Template system
 * 
 * Based on Mastra @mastra/core/workflows
 */

import { createClient } from "@libsql/client";
import * as path from "path";
import { eventBus } from "./event-bus";

// DB Path
const DB_PATH = path.join(process.cwd(), "karya-workflows.db");

// LibSQL Client
const db = createClient({
  url: `file:${DB_PATH}`,
});

// Types
export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: "pending" | "running" | "suspended" | "success" | "failed";
  inputData: Record<string, any>;
  outputData: Record<string, any> | null;
  currentStep: string | null;
  steps: Record<string, StepResult>;
  state: Record<string, any>;
  suspendPayload: Record<string, any> | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface StepResult {
  status: "pending" | "running" | "success" | "failed" | "skipped";
  input: Record<string, any>;
  output: Record<string, any> | null;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "browser" | "file" | "data" | "automation" | "research" | "custom";
  inputSchema: Record<string, any>;
  steps: string[];
  icon: string;
}

// Initialize DB
async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      input_data TEXT NOT NULL,
      output_data TEXT,
      current_step TEXT,
      steps TEXT NOT NULL DEFAULT '{}',
      state TEXT NOT NULL DEFAULT '{}',
      suspend_payload TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status)
  `);
}

// Initialize on module load
initDB().catch(console.error);

/**
 * Create a new workflow run
 */
export async function createWorkflowRun(
  workflowId: string,
  inputData: Record<string, any>
): Promise<string> {
  const id = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO workflow_runs (id, workflow_id, input_data, steps, state, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, workflowId, JSON.stringify(inputData), "{}", "{}", now, now],
  });

  eventBus.emit("workflow:created", { runId: id, workflowId, inputData });

  return id;
}

/**
 * Get a workflow run by ID
 */
export async function getWorkflowRun(runId: string): Promise<WorkflowRun | null> {
  const result = await db.execute({
    sql: "SELECT * FROM workflow_runs WHERE id = ?",
    args: [runId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    workflowId: row.workflow_id as string,
    status: row.status as WorkflowRun["status"],
    inputData: JSON.parse(row.input_data as string),
    outputData: row.output_data ? JSON.parse(row.output_data as string) : null,
    currentStep: row.current_step as string | null,
    steps: JSON.parse(row.steps as string),
    state: JSON.parse(row.state as string),
    suspendPayload: row.suspend_payload ? JSON.parse(row.suspend_payload as string) : null,
    error: row.error as string | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
    completedAt: row.completed_at as number | null,
  };
}

/**
 * Update workflow run status
 */
export async function updateWorkflowRun(
  runId: string,
  updates: Partial<Omit<WorkflowRun, "id" | "workflowId" | "createdAt">>
): Promise<void> {
  const setClauses: string[] = ["updated_at = ?"];
  const args: any[] = [Date.now()];

  if (updates.status !== undefined) {
    setClauses.push("status = ?");
    args.push(updates.status);
  }
  if (updates.outputData !== undefined) {
    setClauses.push("output_data = ?");
    args.push(JSON.stringify(updates.outputData));
  }
  if (updates.currentStep !== undefined) {
    setClauses.push("current_step = ?");
    args.push(updates.currentStep);
  }
  if (updates.steps !== undefined) {
    setClauses.push("steps = ?");
    args.push(JSON.stringify(updates.steps));
  }
  if (updates.state !== undefined) {
    setClauses.push("state = ?");
    args.push(JSON.stringify(updates.state));
  }
  if (updates.suspendPayload !== undefined) {
    setClauses.push("suspend_payload = ?");
    args.push(updates.suspendPayload ? JSON.stringify(updates.suspendPayload) : null);
  }
  if (updates.error !== undefined) {
    setClauses.push("error = ?");
    args.push(updates.error);
  }
  if (updates.completedAt !== undefined) {
    setClauses.push("completed_at = ?");
    args.push(updates.completedAt);
  }

  args.push(runId);

  await db.execute({
    sql: `UPDATE workflow_runs SET ${setClauses.join(", ")} WHERE id = ?`,
    args,
  });

  eventBus.emit("workflow:updated", { runId, updates });
}

/**
 * List workflow runs with filters
 */
export async function listWorkflowRuns(options: {
  workflowId?: string;
  status?: WorkflowRun["status"];
  limit?: number;
}): Promise<WorkflowRun[]> {
  const { workflowId, status, limit = 50 } = options;

  let sql = "SELECT * FROM workflow_runs WHERE 1=1";
  const args: any[] = [];

  if (workflowId) {
    sql += " AND workflow_id = ?";
    args.push(workflowId);
  }
  if (status) {
    sql += " AND status = ?";
    args.push(status);
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  args.push(limit);

  const result = await db.execute({ sql, args });

  return result.rows.map((row) => ({
    id: row.id as string,
    workflowId: row.workflow_id as string,
    status: row.status as WorkflowRun["status"],
    inputData: JSON.parse(row.input_data as string),
    outputData: row.output_data ? JSON.parse(row.output_data as string) : null,
    currentStep: row.current_step as string | null,
    steps: JSON.parse(row.steps as string),
    state: JSON.parse(row.state as string),
    suspendPayload: row.suspend_payload ? JSON.parse(row.suspend_payload as string) : null,
    error: row.error as string | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
    completedAt: row.completed_at as number | null,
  }));
}

/**
 * Delete a workflow run
 */
export async function deleteWorkflowRun(runId: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM workflow_runs WHERE id = ?",
    args: [runId],
  });

  eventBus.emit("workflow:deleted", { runId });
}

/**
 * Get active (running or suspended) runs
 */
export async function getActiveRuns(): Promise<WorkflowRun[]> {
  const result = await db.execute({
    sql: "SELECT * FROM workflow_runs WHERE status IN ('running', 'suspended', 'pending') ORDER BY created_at DESC",
    args: [],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    workflowId: row.workflow_id as string,
    status: row.status as WorkflowRun["status"],
    inputData: JSON.parse(row.input_data as string),
    outputData: row.output_data ? JSON.parse(row.output_data as string) : null,
    currentStep: row.current_step as string | null,
    steps: JSON.parse(row.steps as string),
    state: JSON.parse(row.state as string),
    suspendPayload: row.suspend_payload ? JSON.parse(row.suspend_payload as string) : null,
    error: row.error as string | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
    completedAt: row.completed_at as number | null,
  }));
}

/**
 * Get workflow statistics
 */
export async function getWorkflowStats(): Promise<{
  total: number;
  running: number;
  suspended: number;
  success: number;
  failed: number;
}> {
  const result = await db.execute({
    sql: `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
            SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
          FROM workflow_runs`,
    args: [],
  });

  const row = result.rows[0];
  return {
    total: (row.total as number) || 0,
    running: (row.running as number) || 0,
    suspended: (row.suspended as number) || 0,
    success: (row.success as number) || 0,
    failed: (row.failed as number) || 0,
  };
}

// =====================================
// WORKFLOW TEMPLATES - Generated from actual Mastra workflows
// Single source of truth: src/mastra/workflows/
// =====================================

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "web-scraper",
    name: "Web Scraper",
    description: "Scrape webpage with Stagehand (supports JS-rendered pages), extract content, save to file",
    category: "browser",
    inputSchema: { url: "string", outputPath: "string", selector: "string?", useStagehand: "boolean?" },
    steps: ["navigate-extract", "save-file"],
    icon: "🌐",
  },
  {
    id: "file-organizer",
    name: "File Organizer",
    description: "Scan folder, categorize files by type/extension, move to organized subfolders",
    category: "file",
    inputSchema: { sourcePath: "string", rules: "object?" },
    steps: ["scan-files", "categorize", "move-files"],
    icon: "📁",
  },
  {
    id: "research-pipeline",
    name: "Research Pipeline",
    description: "Search web, visit top sources, extract info, synthesize findings",
    category: "research",
    inputSchema: { query: "string", sources: "number?", depth: "string?" },
    steps: ["search-web", "visit-sources", "extract-info", "synthesize"],
    icon: "🔍",
  },
  {
    id: "data-processor",
    name: "Data Processor",
    description: "Analyze CSV/JSON/TXT files using branching based on file type",
    category: "data",
    inputSchema: { filePath: "string", outputFormat: "string?" },
    steps: ["detect-type", "branch:csv|json|txt", "analyze", "output"],
    icon: "📊",
  },
  {
    id: "backup",
    name: "Backup Manager",
    description: "Collect files from multiple paths, create ZIP archive, copy to backup location",
    category: "automation",
    inputSchema: { sourcePaths: "array", backupPath: "string" },
    steps: ["collect-files", "create-archive", "copy-backup"],
    icon: "💾",
  },
  {
    id: "multi-source-research",
    name: "Multi-Source Research",
    description: "PARALLEL search across Web + Wikipedia + News, combine results",
    category: "research",
    inputSchema: { query: "string", maxResultsPerSource: "number?" },
    steps: ["parallel:web-search|wiki-search|news-search", "combine-results"],
    icon: "🔎",
  },
  {
    id: "file-cleanup",
    name: "File Cleanup (Human-Approved)",
    description: "Scan folder for cleanup candidates, SUSPEND for human approval, then delete if approved",
    category: "file",
    inputSchema: { folderPath: "string", criteria: "object?" },
    steps: ["scan-folder", "identify-candidates", "suspend:approval", "delete-if-approved"],
    icon: "🗑️",
  },
  {
    id: "batch-image-processor",
    name: "Batch Image Processor",
    description: "FOREACH image in folder: resize/compress with options",
    category: "file",
    inputSchema: { folderPath: "string", maxWidth: "number?", quality: "number?", format: "string?" },
    steps: ["find-images", "foreach:resize-compress", "summary"],
    icon: "🖼️",
  },
  {
    id: "url-monitor",
    name: "URL Monitor",
    description: "DOUNTIL loop: poll URL until target status or content found (or max attempts)",
    category: "automation",
    inputSchema: { url: "string", targetStatus: "number?", targetContent: "string?", maxAttempts: "number?" },
    steps: ["dountil:check-url", "report-result"],
    icon: "🔄",
  },
];

/**
 * Get all available templates
 */
export function getWorkflowTemplates(): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES;
}

/**
 * Get template by ID
 */
export function getWorkflowTemplate(templateId: string): WorkflowTemplate | null {
  return WORKFLOW_TEMPLATES.find((t) => t.id === templateId) || null;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: WorkflowTemplate["category"]): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter((t) => t.category === category);
}

// Export singleton
export const workflowEngine = {
  createRun: createWorkflowRun,
  getRun: getWorkflowRun,
  updateRun: updateWorkflowRun,
  listRuns: listWorkflowRuns,
  deleteRun: deleteWorkflowRun,
  getActiveRuns,
  getStats: getWorkflowStats,
  getTemplates: getWorkflowTemplates,
  getTemplate: getWorkflowTemplate,
  getTemplatesByCategory,
};
