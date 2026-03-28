/**
 * PUT    /api/v1/mcp/servers/:id — Update/toggle MCP server
 * DELETE /api/v1/mcp/servers/:id — Remove MCP server
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiNoContent, apiBadRequest, apiNotFound, apiServerError } from "@/lib/api-response";
import { getMCPServers, saveMCPServers } from "@/mastra/mcp/client";

export async function OPTIONS() {
  return handleCORS();
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "mcp-manage");
  if (guard) return guard;

  try {
    const { id } = await params;
    const body = await req.json();
    const { enabled, name, url, apiKey } = body;

    const servers = getMCPServers();
    const idx = servers.findIndex((s: any) => s.name === id || s.id === id);
    if (idx === -1) return apiNotFound("MCP Server");

    // Toggle
    if (typeof enabled === "boolean") {
      servers[idx].enabled = enabled;
    }

    // Update fields
    if (name) servers[idx].name = name;
    if (url) servers[idx].url = url;
    if (apiKey !== undefined) servers[idx].apiKey = apiKey;

    saveMCPServers(servers);
    return apiOk({ id, updated: true, server: servers[idx] });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = apiGuard(req, "mcp-manage");
  if (guard) return guard;

  try {
    const { id } = await params;

    const servers = getMCPServers();
    const filtered = servers.filter((s: any) => s.name !== id && s.id !== id);

    if (filtered.length === servers.length) return apiNotFound("MCP Server");

    saveMCPServers(filtered);
    return apiNoContent();
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
