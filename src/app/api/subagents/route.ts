/**
 * Sub-Agents API — Spawn and manage parallel agents
 * 
 * GET /api/subagents — List sub-agents
 * POST /api/subagents — Spawn, steer, kill sub-agents
 */

import { NextRequest, NextResponse } from "next/server";
import {
  spawnSubAgent,
  spawnParallel,
  getSubAgent,
  listSubAgents,
  listRunningSubAgents,
  killSubAgent,
  steerSubAgent,
  waitForSubAgent,
  waitForAll,
  getSubAgentStats,
  cleanupSubAgents,
} from "@/lib/subagent-spawner";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const id = searchParams.get("id");
  const parentSessionId = searchParams.get("parentSessionId");
  
  // Stats
  if (action === "stats") {
    return NextResponse.json(getSubAgentStats());
  }
  
  // Running only
  if (action === "running") {
    return NextResponse.json({
      subagents: listRunningSubAgents(),
    });
  }
  
  // Get specific sub-agent
  if (id) {
    const subAgent = getSubAgent(id);
    if (!subAgent) {
      return NextResponse.json(
        { error: "Sub-agent not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(subAgent);
  }
  
  // List all or by parent
  return NextResponse.json({
    subagents: listSubAgents(parentSessionId || undefined),
    stats: getSubAgentStats(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    
    switch (action) {
      case "spawn": {
        const { parentSessionId, task, context, timeout } = body;
        
        if (!task) {
          return NextResponse.json(
            { error: "task is required" },
            { status: 400 }
          );
        }
        
        const subAgent = await spawnSubAgent(
          parentSessionId || "api",
          task,
          { context, timeout }
        );
        
        return NextResponse.json({
          success: true,
          subagent: subAgent,
        });
      }
      
      case "spawn-parallel": {
        const { parentSessionId, tasks, timeout, maxConcurrent } = body;
        
        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
          return NextResponse.json(
            { error: "tasks array is required" },
            { status: 400 }
          );
        }
        
        const subAgents = await spawnParallel(
          parentSessionId || "api",
          tasks,
          { timeout, maxConcurrent }
        );
        
        return NextResponse.json({
          success: true,
          subagents: subAgents,
          completed: subAgents.filter(sa => sa.status === "completed").length,
          failed: subAgents.filter(sa => sa.status === "failed").length,
        });
      }
      
      case "steer": {
        const { id, instruction } = body;
        
        if (!id || !instruction) {
          return NextResponse.json(
            { error: "id and instruction are required" },
            { status: 400 }
          );
        }
        
        const result = await steerSubAgent(id, instruction);
        
        if (!result) {
          return NextResponse.json(
            { error: "Sub-agent not found or not running" },
            { status: 404 }
          );
        }
        
        return NextResponse.json({
          success: true,
          subagent: result,
        });
      }
      
      case "kill": {
        const { id } = body;
        
        if (!id) {
          return NextResponse.json(
            { error: "id is required" },
            { status: 400 }
          );
        }
        
        const success = killSubAgent(id);
        
        return NextResponse.json({ success });
      }
      
      case "wait": {
        const { id, timeout } = body;
        
        if (!id) {
          return NextResponse.json(
            { error: "id is required" },
            { status: 400 }
          );
        }
        
        const result = await waitForSubAgent(id, timeout);
        
        return NextResponse.json({
          subagent: result,
        });
      }
      
      case "wait-all": {
        const { ids, timeout } = body;
        
        if (!ids || !Array.isArray(ids)) {
          return NextResponse.json(
            { error: "ids array is required" },
            { status: 400 }
          );
        }
        
        const results = await waitForAll(ids, timeout);
        
        return NextResponse.json({
          subagents: results,
          completed: results.filter(sa => sa.status === "completed").length,
        });
      }
      
      case "cleanup": {
        const { maxAgeMs } = body;
        const deleted = cleanupSubAgents(maxAgeMs);
        
        return NextResponse.json({
          success: true,
          deleted,
        });
      }
      
      default:
        return NextResponse.json(
          { error: "Invalid action. Use: spawn, spawn-parallel, steer, kill, wait, wait-all, cleanup" },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
