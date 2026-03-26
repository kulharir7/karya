import { NextRequest } from "next/server";
import {
  getMCPServers,
  saveMCPServers,
  testMCPServer,
  getMCPTools,
  type MCPServerConfig,
} from "@/mastra/mcp/client";
export const dynamic = "force-dynamic";

/**
 * GET /api/mcp — List all MCP servers + optionally list tools from connected servers
 */
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  if (action === "tools") {
    // List all tools from enabled MCP servers
    try {
      const tools = await getMCPTools();
      const toolList = Object.keys(tools).map((name) => ({
        name,
        description: (tools[name] as any)?.description || "",
      }));
      return Response.json({ success: true, tools: toolList, count: toolList.length });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message, tools: [], count: 0 });
    }
  }

  return Response.json({ servers: getMCPServers() });
}

/**
 * POST /api/mcp — Manage MCP servers (add, remove, toggle, test)
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // Add a new MCP server
  if (action === "add") {
    const servers = getMCPServers();
    const newServer: MCPServerConfig = {
      id: `mcp-${Date.now()}`,
      name: body.name || "New Server",
      url: body.url,
      transport: body.transport || "streamable-http",
      apiKey: body.apiKey || "",
      enabled: true,
    };
    servers.push(newServer);
    saveMCPServers(servers);
    return Response.json({ success: true, server: newServer, servers });
  }

  // Remove a server
  if (action === "remove") {
    const servers = getMCPServers().filter((s) => s.id !== body.id);
    saveMCPServers(servers);
    return Response.json({ success: true, servers });
  }

  // Toggle server ON/OFF
  if (action === "toggle") {
    const servers = getMCPServers().map((s) =>
      s.id === body.id ? { ...s, enabled: !s.enabled } : s
    );
    saveMCPServers(servers);
    return Response.json({ success: true, servers });
  }

  // Update server config
  if (action === "update") {
    const servers = getMCPServers().map((s) => {
      if (s.id !== body.id) return s;
      return {
        ...s,
        name: body.name ?? s.name,
        url: body.url ?? s.url,
        transport: body.transport ?? s.transport,
        apiKey: body.apiKey ?? s.apiKey,
      };
    });
    saveMCPServers(servers);
    return Response.json({ success: true, servers });
  }

  // Test connection to a specific server
  if (action === "test") {
    const server = getMCPServers().find((s) => s.id === body.id);
    if (!server) {
      return Response.json({ success: false, error: "Server not found" }, { status: 404 });
    }
    const result = await testMCPServer(server);
    return Response.json(result);
  }

  // Test a server URL directly (before adding)
  if (action === "test-url") {
    const tempServer: MCPServerConfig = {
      id: "test-temp",
      name: "Test",
      url: body.url,
      transport: body.transport || "streamable-http",
      apiKey: body.apiKey || "",
      enabled: true,
    };
    const result = await testMCPServer(tempServer);
    return Response.json(result);
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
