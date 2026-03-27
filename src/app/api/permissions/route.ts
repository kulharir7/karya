/**
 * Permissions API — Manage tool permissions & confirmations
 * 
 * GET /api/permissions — List all tool permissions
 * GET /api/permissions?action=stats — Get stats
 * GET /api/permissions?action=pending — Get pending confirmations
 * POST /api/permissions — Confirm/deny tool execution
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllPermissions,
  getPermissionStats,
  getToolsByRisk,
  getPendingConfirmations,
  confirmPermission,
  checkPermission,
  getToolPermission,
} from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const tool = searchParams.get("tool");
  const risk = searchParams.get("risk");
  
  // Stats
  if (action === "stats") {
    return NextResponse.json(getPermissionStats());
  }
  
  // Pending confirmations
  if (action === "pending") {
    return NextResponse.json({
      pending: getPendingConfirmations(),
    });
  }
  
  // Check specific tool
  if (tool) {
    return NextResponse.json({
      permission: getToolPermission(tool),
      check: checkPermission(tool),
    });
  }
  
  // Filter by risk
  if (risk) {
    const validRisks = ["safe", "moderate", "dangerous"];
    if (!validRisks.includes(risk)) {
      return NextResponse.json(
        { error: "Invalid risk level" },
        { status: 400 }
      );
    }
    return NextResponse.json({
      risk,
      tools: getToolsByRisk(risk as any),
    });
  }
  
  // All permissions
  return NextResponse.json({
    permissions: getAllPermissions(),
    stats: getPermissionStats(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, confirmId, confirmed } = body;
    
    if (action === "confirm") {
      if (!confirmId) {
        return NextResponse.json(
          { error: "Missing confirmId" },
          { status: 400 }
        );
      }
      
      const success = confirmPermission(confirmId, confirmed === true);
      
      if (!success) {
        return NextResponse.json(
          { error: "Confirmation not found or expired" },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        confirmed: confirmed === true,
      });
    }
    
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
