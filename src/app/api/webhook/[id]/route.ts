/**
 * Legacy webhook route — redirects to v1
 * Kept for backward compatibility.
 */

import { NextRequest } from "next/server";
import { getTrigger, handleWebhook } from "@/lib/triggers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    payload = { body: await req.text().catch(() => "") };
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of req.headers.entries()) {
    if (key.startsWith("x-") || key === "authorization") {
      headers[key] = value;
    }
  }

  const result = await handleWebhook(id, payload, headers);

  if (!result.fired) {
    return Response.json({ error: result.error || "Failed" }, { status: 400 });
  }

  return Response.json({ received: true, triggerId: id });
}
