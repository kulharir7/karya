import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisor";
import { browserAgent } from "./agents/browser";
import { fileAgent } from "./agents/file";
import { coderAgent } from "./agents/coder";
import { researcherAgent } from "./agents/researcher";
import { dataAnalystAgent } from "./agents/data-analyst";
import { createKaryaMCPServer } from "./mcp/server";

// Import workflows
import { 
  webScraperWorkflow,
  fileOrganizerWorkflow,
  researchPipelineWorkflow,
  dataProcessorWorkflow,
  backupWorkflow,
  multiSourceResearchWorkflow,
  fileCleanupWorkflow,
} from "./workflows";

// MCP Server — exposes all tools to external clients
export const karyaMCPServer = createKaryaMCPServer();

// Register ALL agents AND workflows with Mastra
export const mastra = new Mastra({
  agents: {
    karya: supervisorAgent,          // Main orchestrator (default)
    "karya-browser": browserAgent,   // Web browsing specialist
    "karya-file": fileAgent,         // File management specialist
    "karya-coder": coderAgent,       // Programming specialist
    "karya-researcher": researcherAgent, // Research specialist
    "karya-data-analyst": dataAnalystAgent, // Data analysis specialist
  },
  workflows: {
    webScraperWorkflow,
    fileOrganizerWorkflow,
    researchPipelineWorkflow,
    dataProcessorWorkflow,
    backupWorkflow,
    multiSourceResearchWorkflow,
    fileCleanupWorkflow,
  },
  server: {
    port: parseInt(process.env.KARYA_MCP_PORT || "3001"),
  },
});
