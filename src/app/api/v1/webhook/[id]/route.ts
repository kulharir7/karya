/**
 * POST /api/v1/webhook/:id — Receive external webhook and fire trigger
 * GET  /api/v1/webhook/:id — Check if webhook trigger exists
 * 
 * External services (GitHub, Zapier, IFTTT, etc.) POST here.
 * The :id is a trigger ID that was created with type="webhook".
 * 
 * Example:
 *   1. Create trigger: POST /api/v1/triggers { type: "webhook", name: "GitHub Push", action: "..." }
 *   2. GitHub sends: POST /api/v1/webhook/trigger-abc123 { ... }
 *   3. Karya agent processes the payload
 * 
 * Optional security: set config.secret on the trigger, then
 * include X-Webhook-Secret or Authorization header.
 */

import { NextRequest } from "next/server";
import { handleCORS } from "@/lib/api-middleware";
import { apiOk, apiNotFound, apiError, apiServerError } from "@/lib/api-response";
import { getTrigger, handleWebhook } from "@/lib/triggers";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trigger = getTrigger(id);

    if (!trigger) return apiNotFound("Webhook trigger");
    if (trigger.type !== "webhook") return apiError("INVALID", "Not a webhook trigger", 400);

    return apiOk({
      id: trigger.id,
      name: trigger.name,
      enabled: trigger.enabled,
      triggerCount: trigger.triggerCount,
      lastTriggered: trigger.lastTriggered,
      hasSecret: !!trigger.config.secret,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Parse payload (JSON or text)
    let payload: any;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await req.json().catch(() => ({}));
    } else if (contentType.includes("form")) {
      const formData = await req.formData().catch(() => new FormData());
      payload = Object.fromEntries(formData.entries());
    } else {
      payload = { body: await req.text().catch(() => "") };
    }

    // Extract headers for secret validation
    const headers: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
      if (key.startsWith("x-") || key === "authorization") {
        headers[key] = value;
      }
    }

    // Fire the webhook
    const result = await handleWebhook(id, payload, headers);

    if (!result.fired) {
      if (result.error === "Trigger not found") {
        return apiNotFound("Webhook trigger");
      }
      return apiError("WEBHOOK_FAILED", result.error || "Failed", 400);
    }

    return apiOk({
      received: true,
      triggerId: id,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
