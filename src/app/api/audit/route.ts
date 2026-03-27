/**
 * Audit Log API — View and manage audit entries
 * 
 * GET /api/audit — Get audit entries
 * GET /api/audit?action=stats — Get statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuditLog, getAuditStats, clearOldAudit, AuditAction } from "@/lib/audit-log";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  
  // Stats
  if (action === "stats") {
    const days = parseInt(searchParams.get("days") || "7");
    const stats = await getAuditStats(days);
    return NextResponse.json(stats);
  }
  
  // Get entries
  const options: any = {};
  
  if (searchParams.get("limit")) {
    options.limit = parseInt(searchParams.get("limit")!);
  }
  if (searchParams.get("offset")) {
    options.offset = parseInt(searchParams.get("offset")!);
  }
  if (searchParams.get("type")) {
    options.action = searchParams.get("type") as AuditAction;
  }
  if (searchParams.get("sessionId")) {
    options.sessionId = searchParams.get("sessionId");
  }
  if (searchParams.get("tool")) {
    options.tool = searchParams.get("tool");
  }
  if (searchParams.get("success")) {
    options.success = searchParams.get("success") === "true";
  }
  
  const entries = await getAuditLog(options);
  
  return NextResponse.json({
    entries,
    count: entries.length,
  });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const daysToKeep = parseInt(searchParams.get("keep") || "30");
  
  const deleted = await clearOldAudit(daysToKeep);
  
  return NextResponse.json({
    success: true,
    deleted,
    message: `Deleted ${deleted} entries older than ${daysToKeep} days`,
  });
}
