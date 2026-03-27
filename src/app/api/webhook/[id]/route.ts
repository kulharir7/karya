/**
 * Webhook Endpoint — Receive external webhooks
 * 
 * POST /api/webhook/:id — Trigger a webhook by ID
 * 
 * External services (GitHub, Stripe, etc.) can send webhooks here.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleWebhook, getTrigger } from "@/lib/triggers";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  
  // Get trigger
  const trigger = getTrigger(id);
  if (!trigger) {
    return NextResponse.json(
      { error: "Webhook not found" },
      { status: 404 }
    );
  }
  
  if (trigger.type !== "webhook") {
    return NextResponse.json(
      { error: "Not a webhook trigger" },
      { status: 400 }
    );
  }
  
  if (!trigger.enabled) {
    return NextResponse.json(
      { error: "Webhook is disabled" },
      { status: 400 }
    );
  }
  
  // Parse payload
  let payload: any = {};
  const contentType = req.headers.get("content-type") || "";
  
  if (contentType.includes("application/json")) {
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    payload = Object.fromEntries(new URLSearchParams(text));
  } else {
    payload = { raw: await req.text() };
  }
  
  // Add headers info
  payload._headers = {
    "x-github-event": req.headers.get("x-github-event"),
    "x-stripe-signature": req.headers.get("stripe-signature"),
    "content-type": contentType,
  };
  
  // Fire webhook
  const success = handleWebhook(id, payload);
  
  if (success) {
    return NextResponse.json({ success: true, message: "Webhook received" });
  } else {
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

// Also handle GET for webhook testing
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  
  const trigger = getTrigger(id);
  if (!trigger) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }
  
  return NextResponse.json({
    id: trigger.id,
    name: trigger.name,
    type: trigger.type,
    enabled: trigger.enabled,
    triggerCount: trigger.triggerCount,
    lastTriggered: trigger.lastTriggered,
    webhookUrl: `${req.nextUrl.origin}/api/webhook/${id}`,
  });
}
