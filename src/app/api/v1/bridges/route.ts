/**
 * GET  /api/v1/bridges — List all bridges and their status
 * POST /api/v1/bridges — Start or stop a bridge
 * 
 * POST body:
 *   { "action": "start", "type": "telegram" }
 *   { "action": "stop", "type": "telegram" }
 *   { "action": "start-all" }
 *   { "action": "stop-all" }
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiBadRequest, apiServerError } from "@/lib/api-response";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "status");
  if (guard) return guard;

  try {
    const { getGateway } = await import("@/bridges/gateway");
    const gateway = getGateway();

    return apiOk({
      running: gateway.isRunning(),
      bridges: gateway.getStatus(),
      available: gateway.getAvailableBridges(),
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "bridges");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { action, type } = body;

    const { getGateway } = await import("@/bridges/gateway");
    const gateway = getGateway();

    switch (action) {
      case "start": {
        if (!type) return apiBadRequest("type is required (telegram, whatsapp, discord)");
        const info = await gateway.startBridge(type);
        return apiOk({ action: "started", bridge: info });
      }

      case "stop": {
        if (!type) return apiBadRequest("type is required");
        await gateway.stopBridge(type);
        return apiOk({ action: "stopped", type });
      }

      case "start-all": {
        await gateway.initAll();
        return apiOk({ action: "started-all", bridges: gateway.getStatus() });
      }

      case "stop-all": {
        await gateway.stopAll();
        return apiOk({ action: "stopped-all" });
      }

      default:
        return apiBadRequest("action must be: start, stop, start-all, stop-all");
    }
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
