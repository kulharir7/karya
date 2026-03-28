/**
 * GET  /api/v1/mcp/servers — List MCP servers
 * POST /api/v1/mcp/servers — Add a new MCP server
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiCreated, apiBadRequest, apiServerError } from "@/lib/api-response";
import { getMCPServers, saveMCPServers, testMCPServer } from "@/mastra/mcp/client";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "mcp-list");
  if (guard) return guard;

  try {
    const servers = getMCPServers();
    return apiOk({
      servers,
      count: servers.length,
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "mcp-manage");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { name, url, transport = "streamable-http", apiKey, action } = body;

    // Test a server without adding it
    if (action === "test") {
      if (!url) return apiBadRequest("url is required for testing");
      const serverConfig = { id: `test-${Date.now()}`, name: "test", url, transport, apiKey, enabled: true };
      const result = await testMCPServer(serverConfig);
      return apiOk(result);
    }

    // Add server
    if (!name || !url) {
      return apiBadRequest("name and url are required");
    }

    const servers = getMCPServers();
    const newServer = { id: `mcp-${Date.now()}`, name, url, transport, apiKey: apiKey || "", enabled: true };
    servers.push(newServer);
    saveMCPServers(servers);

    return apiCreated(newServer);
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
