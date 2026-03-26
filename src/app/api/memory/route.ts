import { NextRequest } from "next/server";
import {
  searchMemory,
  readWorkspaceFile,
  writeWorkspaceFile,
  listMemoryFiles,
  initWorkspace,
  logToDaily,
} from "@/lib/memory-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/memory — Search memory or list files
 * ?action=search&q=query — search memory files
 * ?action=list — list all memory files
 * ?action=read&file=MEMORY.md — read a specific file
 */
export async function GET(req: NextRequest) {
  initWorkspace();
  const action = req.nextUrl.searchParams.get("action") || "list";

  if (action === "search") {
    const q = req.nextUrl.searchParams.get("q") || "";
    if (!q) return Response.json({ error: "q parameter required" }, { status: 400 });
    const results = searchMemory(q);
    return Response.json({ results, count: results.length });
  }

  if (action === "read") {
    const file = req.nextUrl.searchParams.get("file") || "MEMORY.md";
    const content = readWorkspaceFile(file);
    return Response.json({ file, content, exists: content.length > 0 });
  }

  // Default: list files
  const files = listMemoryFiles();
  return Response.json({ files, count: files.length });
}

/**
 * POST /api/memory — Write to memory files
 * { action: "write", file: "MEMORY.md", content: "..." }
 * { action: "log", entry: "..." } — append to today's log
 */
export async function POST(req: NextRequest) {
  initWorkspace();
  const body = await req.json();

  if (body.action === "write") {
    if (!body.file || !body.content) {
      return Response.json({ error: "file and content required" }, { status: 400 });
    }
    writeWorkspaceFile(body.file, body.content);
    return Response.json({ success: true, file: body.file });
  }

  if (body.action === "log") {
    if (!body.entry) {
      return Response.json({ error: "entry required" }, { status: 400 });
    }
    logToDaily(body.entry);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
