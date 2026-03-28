/**
 * WebSocket API Route — Status and control
 * 
 * The actual WebSocket server runs on a separate port (3002).
 * This route provides HTTP endpoints for status and control.
 * 
 * GET  /api/ws — Get WebSocket server status + connection info
 * POST /api/ws — Control WebSocket server (start/stop/status/clients)
 */

import { NextRequest, NextResponse } from "next/server";
import { wsServer } from "@/lib/websocket-server";

export async function GET(req: NextRequest) {
  const port = process.env.KARYA_WS_PORT || "3002";
  const running = wsServer.isRunning();

  return NextResponse.json({
    status: running ? "running" : "stopped",
    port: parseInt(port),
    url: `ws://localhost:${port}`,
    clients: wsServer.getClientCount(),
    clientDetails: wsServer.getClients(),
    usage: {
      connect: `ws://localhost:${port}`,
      connectWithAuth: `ws://localhost:${port}?token=karya_xxx`,
      protocol: "JSON messages over WebSocket",
      messages: {
        subscribe: '{ "type": "subscribe", "sessionId": "your-session-id" }',
        chat: '{ "type": "chat", "sessionId": "session-id", "data": { "message": "hello" } }',
        abort: '{ "type": "abort" }',
        ping: '{ "type": "ping" }',
        sessions: '{ "type": "sessions-list" }',
        tools: '{ "type": "tools-list" }',
        status: '{ "type": "status" }',
      },
    },
    events: [
      "session — connection events (connected, subscribed, agent_start, agent_end, aborted)",
      "text-delta — streaming text chunks { delta }",
      "tool-call — tool execution started { toolName, args }",
      "tool-result — tool execution finished { toolName, result }",
      "done — request complete { text, toolCount, durationMs }",
      "error — error occurred { message }",
      "pong — heartbeat response",
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
          url: `ws://localhost:${process.env.KARYA_WS_PORT || "3002"}`,
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
          running: wsServer.isRunning(),
          clients: wsServer.getClientCount(),
          clientDetails: wsServer.getClients(),
        });

      case "clients":
        return NextResponse.json({
          success: true,
          clients: wsServer.getClients(),
          count: wsServer.getClientCount(),
        });

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: start, stop, status, clients" },
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
