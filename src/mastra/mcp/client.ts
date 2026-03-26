import { MCPClient } from "@mastra/mcp";
import * as fs from "fs";
import * as path from "path";

/**
 * MCP Client — connects to external MCP servers using official @mastra/mcp.
 * 
 * Config stored in karya-mcp.json at project root.
 * Each server entry:
 *   { id, name, url, transport, apiKey?, enabled }
 * 
 * Usage:
 *   const client = await createMCPClient();
 *   const tools = await client.getTools();  // Record<string, Tool>
 *   // Pass tools to Mastra agent via spread
 */

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  transport: "sse" | "streamable-http";
  apiKey?: string;
  enabled: boolean;
}

const CONFIG_FILE = "karya-mcp.json";
let activeClient: MCPClient | null = null;

function getConfigPath(): string {
  return path.join(process.cwd(), CONFIG_FILE);
}

export function getMCPServers(): MCPServerConfig[] {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("[MCP Client] Failed to read config:", err);
  }
  return [];
}

export function saveMCPServers(servers: MCPServerConfig[]): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(servers, null, 2), "utf-8");
}

/**
 * Create an MCPClient from all enabled servers in config.
 * Returns null if no servers are enabled.
 */
export async function createMCPClient(): Promise<MCPClient | null> {
  const servers = getMCPServers().filter((s) => s.enabled);
  if (servers.length === 0) return null;

  // Build official MCPClient server config
  const serverConfigs: Record<string, any> = {};
  for (const server of servers) {
    serverConfigs[server.id] = {
      url: new URL(server.url),
      ...(server.apiKey
        ? {
            requestInit: {
              headers: {
                Authorization: `Bearer ${server.apiKey}`,
              },
            },
          }
        : {}),
    };
  }

  activeClient = new MCPClient({
    id: "karya-mcp-client",
    servers: serverConfigs,
    timeout: 30000,
  });

  return activeClient;
}

/**
 * Get all tools from connected MCP servers.
 * Returns tools in Mastra-compatible format (Record<string, Tool>).
 * These can be spread directly into an Agent's tools config.
 */
export async function getMCPTools(): Promise<Record<string, any>> {
  try {
    const client = await createMCPClient();
    if (!client) return {};

    // Official Mastra MCPClient API: listTools() returns Record<string, Tool>
    const tools = await client.listTools();
    return tools;
  } catch (err) {
    console.error("[MCP Client] Tool discovery failed:", err);
    return {};
  }
}

/**
 * Get MCP tools as toolsets for Mastra Agent.generate().
 * listToolsets() returns format compatible with agent toolsets param.
 */
export async function getMCPToolsets(): Promise<Record<string, any>> {
  try {
    const client = await createMCPClient();
    if (!client) return {};

    const toolsets = await client.listToolsets();
    return toolsets;
  } catch (err) {
    console.error("[MCP Client] Toolset fetch failed:", err);
    return {};
  }
}

/**
 * Test connection to a specific MCP server.
 * Returns { success, toolCount, tools[], error? }
 */
export async function testMCPServer(server: MCPServerConfig): Promise<{
  success: boolean;
  toolCount: number;
  tools: string[];
  error?: string;
}> {
  try {
    const testClient = new MCPClient({
      id: `karya-test-${server.id}`,
      servers: {
        [server.id]: {
          url: new URL(server.url),
          ...(server.apiKey
            ? {
                requestInit: {
                  headers: {
                    Authorization: `Bearer ${server.apiKey}`,
                  },
                },
              }
            : {}),
        },
      },
      timeout: 15000,
    });

    const tools = await testClient.listTools();
    const toolNames = Object.keys(tools);

    await testClient.disconnect();

    return {
      success: true,
      toolCount: toolNames.length,
      tools: toolNames,
    };
  } catch (err: any) {
    return {
      success: false,
      toolCount: 0,
      tools: [],
      error: err.message || "Connection failed",
    };
  }
}

/**
 * Disconnect active MCP client and release resources.
 */
export async function disconnectMCP(): Promise<void> {
  if (activeClient) {
    await activeClient.disconnect();
    activeClient = null;
  }
}
