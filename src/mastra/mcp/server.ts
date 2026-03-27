import { MCPServer } from "@mastra/mcp";

// Import ALL actual tools — no duplicates, no re-creation
// Browser tools
import { navigateTool } from "../tools/browser/navigate";
import { actTool } from "../tools/browser/act";
import { extractTool } from "../tools/browser/extract";
import { screenshotTool } from "../tools/browser/screenshot";
import { webSearchTool } from "../tools/browser/search";
import { browserAgentTool } from "../tools/browser/multi";

// File tools
import {
  readFileTool, writeFileTool, listFilesTool, moveFileTool, searchFilesTool,
} from "../tools/file";
import { readPdfTool } from "../tools/file/pdf";
import { resizeImageTool } from "../tools/file/image";
import { zipFilesTool, unzipFilesTool } from "../tools/file/archive";
import { batchRenameTool, fileSizeTool } from "../tools/file/batch";

// Shell tools
import { executeCommandTool } from "../tools/shell";

// System tools
import {
  systemInfoTool, clipboardReadTool, clipboardWriteTool, notifyTool,
} from "../tools/system";
import { dateTimeTool, processListTool, openAppTool, killProcessTool } from "../tools/system/advanced";

// Code tools
import { codeWriteTool, codeExecuteTool, codeAnalyzeTool } from "../tools/code";

// Data tools
import { apiCallTool, csvParseTool, jsonQueryTool, dataTransformTool } from "../tools/data";

// Memory tools
import {
  memorySearchTool, memoryReadTool, memoryWriteTool, memoryLogTool, memoryListTool,
} from "../tools/memory";

// Scheduler tools
import { scheduleTaskTool, listTasksTool, cancelTaskTool } from "../tools/scheduler";

// Agent delegation tools (Supervisor Pattern)
import {
  delegateToBrowserAgent, delegateToFileAgent, delegateToCoderAgent,
  delegateToResearcherAgent, delegateToDataAnalystAgent,
  passContextToAgent, agentHandoffTool, codeReviewTool,
} from "../tools/agents";

// Planning tools (Point 5)
import { createPlanTool, executePlanStepTool, reviewOutputTool, getPlanStatusTool } from "../tools/planning";

// Error Recovery tools (Point 7)
import { suggestRecoveryTool, logRecoveryTool } from "../tools/recovery";

// Confidence tools (Point 10)
import { confidenceCheckTool } from "../tools/confidence";

// Git tools (Point 48)
import { gitStatusTool, gitCommitTool, gitPushTool, gitLogTool, gitDiffTool } from "../tools/git";

/**
 * Karya MCP Server — exposes ALL 32 tools to external MCP clients.
 * 
 * Any MCP-compatible client can connect:
 * - Cursor IDE
 * - Claude Desktop
 * - Windsurf
 * - VS Code (with MCP extension)
 * - Other Mastra agents
 * - Any MCP SDK client
 * 
 * Transport: Streamable HTTP (default) + SSE fallback
 * Port: 3001 (configurable via KARYA_MCP_PORT env)
 */
export function createKaryaMCPServer() {
  return new MCPServer({
    name: "karya",
    version: "1.0.0",
    tools: {
      // === Browser (6) ===
      navigateTool,
      actTool,
      extractTool,
      screenshotTool,
      webSearchTool,
      browserAgentTool,

      // === File (10) ===
      readFileTool,
      writeFileTool,
      listFilesTool,
      moveFileTool,
      searchFilesTool,
      readPdfTool,
      resizeImageTool,
      zipFilesTool,
      unzipFilesTool,
      batchRenameTool,
      fileSizeTool,

      // === Shell (1) ===
      executeCommandTool,

      // === System (8) ===
      systemInfoTool,
      clipboardReadTool,
      clipboardWriteTool,
      notifyTool,
      dateTimeTool,
      processListTool,
      openAppTool,
      killProcessTool,

      // === Code (3) ===
      codeWriteTool,
      codeExecuteTool,
      codeAnalyzeTool,

      // === Data (4) ===
      apiCallTool,
      csvParseTool,
      jsonQueryTool,
      dataTransformTool,

      // === Memory (5) ===
      memorySearchTool,
      memoryReadTool,
      memoryWriteTool,
      memoryLogTool,
      memoryListTool,

      // === Scheduler (3) ===
      scheduleTaskTool,
      listTasksTool,
      cancelTaskTool,

      // === Agent Delegation (5) ===
      delegateToBrowserAgent,
      delegateToFileAgent,
      delegateToCoderAgent,
      delegateToResearcherAgent,
      delegateToDataAnalystAgent,
      passContextToAgent,
      agentHandoffTool,
      codeReviewTool,

      // === Planning (4) ===
      createPlanTool,
      executePlanStepTool,
      reviewOutputTool,
      getPlanStatusTool,

      // === Error Recovery (2) ===
      suggestRecoveryTool,
      logRecoveryTool,

      // === Confidence (1) ===
      confidenceCheckTool,

      // === Git (5) ===
      gitStatusTool,
      gitCommitTool,
      gitPushTool,
      gitLogTool,
      gitDiffTool,
    },
  });
}
