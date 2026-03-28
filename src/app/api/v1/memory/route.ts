/**
 * GET  /api/v1/memory — Search memory (?q=query) or list files
 * POST /api/v1/memory — Write/update a memory file
 * 
 * Query params:
 *   ?q=search+query — Search across all memory files
 *   ?file=MEMORY.md — Read a specific file
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiBadRequest, apiServerError } from "@/lib/api-response";
import {
  searchMemory,
  readWorkspaceFile,
  writeWorkspaceFile,
  listMemoryFiles,
  logToDaily,
  initWorkspace,
} from "@/lib/memory-engine";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "memory-search");
  if (guard) return guard;

  try {
    initWorkspace();
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const file = searchParams.get("file");

    // Read specific file
    if (file) {
      try {
        const content = readWorkspaceFile(file);
        return apiOk({ file, content, exists: true, length: content.length });
      } catch {
        return apiOk({ file, content: null, exists: false });
      }
    }

    // Search
    if (query) {
      const results = searchMemory(query);
      return apiOk({
        query,
        results,
        count: results.length,
      });
    }

    // List all files
    const files = listMemoryFiles();
    return apiOk({
      files,
      count: files.length,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "memory-write");
  if (guard) return guard;

  try {
    initWorkspace();
    const body = await req.json();
    const { file, content } = body;

    if (!file || typeof file !== "string") {
      return apiBadRequest("file is required (e.g., MEMORY.md, memory/notes.md)");
    }

    if (content === undefined || content === null) {
      return apiBadRequest("content is required");
    }

    writeWorkspaceFile(file, content);
    return apiOk({ file, written: true, length: content.length });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
