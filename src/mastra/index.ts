import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisor";
import { createKaryaMCPServer } from "./mcp/server";

// MCP Server instance (can be started separately)
export const karyaMCPServer = createKaryaMCPServer();

export const mastra = new Mastra({
  agents: {
    karya: supervisorAgent,
  },
  server: {
    port: 3001, // MCP server on separate port
  },
});
