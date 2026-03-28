/**
 * GET /api/v1/agents — List all available agents with capabilities
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiServerError } from "@/lib/api-response";

// Agent definitions (matches mastra/index.ts)
const AGENTS = [
  {
    id: "karya",
    name: "Supervisor",
    role: "Main orchestrator — delegates to specialists via tools",
    icon: "⚡",
    tools: "ALL",
    specialty: ["complex tasks", "multi-domain", "orchestration", "general"],
  },
  {
    id: "karya-browser",
    name: "Browser Agent",
    role: "Web browsing, site interaction, scraping",
    icon: "🌐",
    tools: "browser-navigate, browser-act, browser-extract, browser-screenshot, web-search, browser-agent",
    specialty: ["web browsing", "scraping", "form filling"],
  },
  {
    id: "karya-file",
    name: "File Agent",
    role: "File/folder management, PDF, images, archives",
    icon: "📁",
    tools: "file-read, file-write, file-list, file-move, file-search, file-read-pdf, file-resize-image, file-zip, file-unzip, file-batch-rename, file-size-info",
    specialty: ["file operations", "organization", "PDF", "images"],
  },
  {
    id: "karya-coder",
    name: "Coder Agent",
    role: "Programming, git, build, debug",
    icon: "💻",
    tools: "code-write, code-execute, code-analyze, shell-execute, file-read, file-write, file-list, git-status, git-commit, git-push, git-log, git-diff",
    specialty: ["coding", "debugging", "git", "scripting"],
  },
  {
    id: "karya-researcher",
    name: "Researcher Agent",
    role: "Deep web research, information synthesis",
    icon: "🔬",
    tools: "web-search, browser-navigate, browser-extract, memory-search, memory-read, memory-write, memory-log, memory-list, memory-recall",
    specialty: ["research", "information gathering", "summarization"],
  },
  {
    id: "karya-data-analyst",
    name: "Data Analyst Agent",
    role: "CSV/JSON analysis, statistics, data processing",
    icon: "📊",
    tools: "data-csv-parse, data-json-query, data-transform, api-call, file-read, file-write, file-list, code-write, code-execute, code-analyze",
    specialty: ["data analysis", "CSV", "JSON", "statistics"],
  },
];

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "agents-list");
  if (guard) return guard;

  try {
    return apiOk({
      agents: AGENTS,
      count: AGENTS.length,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
