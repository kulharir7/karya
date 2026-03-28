/**
 * GET  /api/v1/ws — WebSocket server status and connection info
 * POST /api/v1/ws — Control WebSocket server (start/stop)
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiBadRequest, apiServerError } from "@/lib/api-response";
import { wsServer } from "@/lib/websocket-server";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "status");
  if (guard) return guard;

  try {
    const port = process.env.KARYA_WS_PORT || "3002";

    return apiOk({
      running: wsServer.isRunning(),
      port: parseInt(port),
      url: `ws://localhost:${port}`,
      clients: wsServer.getClients(),
      clientCount: wsServer.getClientCount(),
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "admin");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "start") {
      wsServer.start();
      return apiOk({ action: "started", running: true });
    }

    if (action === "stop") {
      wsServer.stop();
      return apiOk({ action: "stopped", running: false });
    }

    return apiBadRequest("action must be 'start' or 'stop'");
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
