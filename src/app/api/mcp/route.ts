import { NextRequest } from "next/server";
import { getMCPServers, saveMCPServers } from "@/mastra/mcp/client";

export async function GET() {
  return Response.json({ servers: getMCPServers() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "add") {
    const servers = getMCPServers();
    servers.push({
      id: `mcp-${Date.now()}`,
      name: body.name || "New Server",
      url: body.url,
      transport: body.transport || "sse",
      apiKey: body.apiKey || "",
      enabled: true,
    });
    saveMCPServers(servers);
    return Response.json({ success: true, servers });
  }

  if (action === "remove") {
    const servers = getMCPServers().filter((s) => s.id !== body.id);
    saveMCPServers(servers);
    return Response.json({ success: true, servers });
  }

  if (action === "toggle") {
    const servers = getMCPServers().map((s) =>
      s.id === body.id ? { ...s, enabled: !s.enabled } : s
    );
    saveMCPServers(servers);
    return Response.json({ success: true, servers });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
