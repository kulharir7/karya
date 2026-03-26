import { MCPClient } from "@mastra/mcp";

// MCP Client — connects to external MCP servers
// Official Mastra @mastra/mcp API

interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  transport: "sse" | "streamable-http";
  apiKey?: string;
  enabled: boolean;
}

let mcpClient: MCPClient | null = null;

export function getMCPServers(): MCPServerConfig[] {
  try {
    const fs = require("fs");
    const path = require("path");
    const configPath = path.join(process.cwd(), "karya-mcp.json");
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch {}
  return [];
}

export function saveMCPServers(servers: MCPServerConfig[]) {
  const fs = require("fs");
  const path = require("path");
  fs.writeFileSync(
    path.join(process.cwd(), "karya-mcp.json"),
    JSON.stringify(servers, null, 2)
  );
}

export async function createMCPClient(): Promise<MCPClient | null> {
  const servers = getMCPServers().filter((s) => s.enabled);
  if (servers.length === 0) return null;

  // Build official MCPClient config
  // Format: { servers: { name: { url: URL, requestInit?: {...} } } }
  const serverConfigs: Record<string, any> = {};
  for (const server of servers) {
    serverConfigs[server.id] = {
      url: new URL(server.url),
      ...(server.apiKey
        ? { requestInit: { headers: { Authorization: `Bearer ${server.apiKey}` } } }
        : {}),
    };
  }

  mcpClient = new MCPClient({
    id: "karya-mcp",
    servers: serverConfigs,
    timeout: 30000,
  });

  return mcpClient;
}

// Get all tools from connected MCP servers
// Returns tools compatible with Mastra Agent tools format
export async function getMCPTools(): Promise<Record<string, any>> {
  const client = await createMCPClient();
  if (!client) return {};

  try {
    // Official API: mcp.listTools() returns Record<string, Tool>
    const tools = await client.listTools();
    return tools;
  } catch (err) {
    console.error("MCP tools discovery error:", err);
    return {};
  }
}

export async function disconnectMCP() {
  if (mcpClient) {
    await mcpClient.disconnect();
    mcpClient = null;
  }
}
