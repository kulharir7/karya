/**
 * Triggers API — Manage file/clipboard/webhook triggers
 * 
 * GET /api/triggers — List all triggers
 * POST /api/triggers — Create trigger or handle actions
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createTrigger,
  listTriggers,
  getTrigger,
  toggleTrigger,
  deleteTrigger,
  getTriggerStats,
  handleWebhook,
} from "@/lib/triggers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const id = searchParams.get("id");

  if (action === "stats") {
    return NextResponse.json(getTriggerStats());
  }

  if (id) {
    const trigger = getTrigger(id);
    if (!trigger) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }
    return NextResponse.json(trigger);
  }

  return NextResponse.json({
    triggers: listTriggers(),
    stats: getTriggerStats(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const { type, name, config, taskAction } = body;
        
        if (!type || !name || !taskAction) {
          return NextResponse.json(
            { error: "Missing required fields: type, name, taskAction" },
            { status: 400 }
          );
        }
        
        const trigger = createTrigger(type, name, config || {}, taskAction);
        return NextResponse.json({ success: true, trigger });
      }

      case "toggle": {
        const { id, enabled } = body;
        if (!id) {
          return NextResponse.json({ error: "Missing id" }, { status: 400 });
        }
        const success = toggleTrigger(id, enabled);
        return NextResponse.json({ success });
      }

      case "delete": {
        const { id } = body;
        if (!id) {
          return NextResponse.json({ error: "Missing id" }, { status: 400 });
        }
        const success = deleteTrigger(id);
        return NextResponse.json({ success });
      }

      case "webhook": {
        // Handle incoming webhook
        const { triggerId, payload } = body;
        if (!triggerId) {
          return NextResponse.json({ error: "Missing triggerId" }, { status: 400 });
        }
        const success = handleWebhook(triggerId, payload);
        return NextResponse.json({ success });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: create, toggle, delete, webhook" },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
