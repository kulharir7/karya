import { NextResponse } from "next/server";

export async function GET() {
  const startTime = Date.now();
  
  // Check memory system
  let memoryStatus = "unknown";
  try {
    const { getMemoryInstance } = await import("@/lib/semantic-memory");
    const mem = await getMemoryInstance();
    memoryStatus = mem ? "active" : "none";
  } catch {
    memoryStatus = "error";
  }
  
  // Check database
  let dbStatus = "unknown";
  try {
    const { getAuditStats } = await import("@/lib/audit-log");
    await getAuditStats();
    dbStatus = "connected";
  } catch {
    dbStatus = "error";
  }
  
  // Check scheduler
  let schedulerStatus = "unknown";
  try {
    const { listTasks } = await import("@/lib/scheduler");
    await listTasks();
    schedulerStatus = "active";
  } catch {
    schedulerStatus = "error";
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    responseTime: Date.now() - startTime,
    services: {
      memory: memoryStatus,
      database: dbStatus,
      scheduler: schedulerStatus,
    },
    version: process.env.npm_package_version || "1.0.0",
    nodeVersion: process.version,
    uptime: process.uptime(),
  });
}
