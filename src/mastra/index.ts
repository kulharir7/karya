import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisor";
import { createKaryaMCPServer } from "./mcp/server";

// MCP Server — exposes all 32 tools to external clients
// Cursor, Claude Desktop, Windsurf, VS Code, other agents can connect
export const karyaMCPServer = createKaryaMCPServer();

export const mastra = new Mastra({
  agents: {
    karya: supervisorAgent,
  },
  server: {
    port: parseInt(process.env.KARYA_MCP_PORT || "3001"),
  },
});
