/**
 * WebSocket API Route — Status and control
 * 
 * Note: Actual WebSocket server runs on separate port (3002)
 * This route provides status and control endpoints.
 * 
 * GET /api/ws — Get WebSocket server status
 * POST /api/ws — Control WebSocket server (start/stop)
 */

import { NextRequest, NextResponse } from "next/server";
import { wsServer } from "@/lib/websocket-server";

export async function GET(req: NextRequest) {
  const port = process.env.KARYA_WS_PORT || "3002";
  
  return NextResponse.json({
    status: "info",
    port: parseInt(port),
    url: `ws://localhost:${port}`,
    clients: wsServer.getClientCount(),
    usage: {
      connect: `ws://localhost:${port}`,
      subscribe: '{ "type": "subscribe", "sessionId": "your-session-id" }',
      chat: '{ "type": "chat", "sessionId": "session-id", "data": { "message": "hello" } }',
      ping: '{ "type": "ping" }',
    },
    events: [
      "text-delta — streaming text chunks",
      "text — complete response",
      "tool-call — tool execution started",
      "tool-result — tool execution finished",
      "error — error occurred",
      "session — session events (connected, subscribed, agent_start, agent_end)",
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "start":
        wsServer.start();
        return NextResponse.json({
          success: true,
          message: "WebSocket server started",
          port: process.env.KARYA_WS_PORT || "3002",
        });

      case "stop":
        wsServer.stop();
        return NextResponse.json({
          success: true,
          message: "WebSocket server stopped",
        });

      case "status":
        return NextResponse.json({
          success: true,
          clients: wsServer.getClientCount(),
        });

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: start, stop, status" },
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
