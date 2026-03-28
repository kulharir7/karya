import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import * as path from "path";
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
  batchImageProcessorWorkflow,
  urlMonitorWorkflow,
} from "./workflows";

// MCP Server — exposes all tools to external clients
export const karyaMCPServer = createKaryaMCPServer();

// Instance-level storage — shared by all agents for memory persistence
const storage = new LibSQLStore({
  id: "karya-storage",
  url: `file:${path.join(process.cwd(), "data", "karya-memory.db")}`,
});

// Workspace — lazy init to avoid Turbopack issues
let workspace: any = undefined;
try {
  const { Workspace, LocalFilesystem, LocalSandbox } = require("@mastra/core/workspace");
  workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: path.join(process.cwd(), "workspace") }),
    sandbox: new LocalSandbox({ workingDirectory: process.cwd() }),
    skills: [path.join(process.cwd(), "workspace", "plugins")],
  });
} catch {
  // Workspace not available in this environment
}

// Register ALL agents AND workflows with Mastra
export const mastra = new Mastra({
  storage,
  ...(workspace ? { workspace } : {}),
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
    batchImageProcessorWorkflow,
    urlMonitorWorkflow,
  },
  server: {
    port: parseInt(process.env.KARYA_MCP_PORT || "3001"),
  },
});
