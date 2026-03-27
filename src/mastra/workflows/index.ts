/**
 * Karya Mastra Workflows
 * 
 * Graph-based workflows using @mastra/core/workflows
 * Features:
 * - Branching (conditional routing)
 * - Parallel execution
 * - Chaining (sequential steps)
 * - Suspend/Resume
 * - Loops (foreach, dowhile, dountil)
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Re-export workflow primitives
export { createWorkflow, createStep };

// Import all workflows
import { webScraperWorkflow } from "./web-scraper";
import { fileOrganizerWorkflow } from "./file-organizer";
import { researchPipelineWorkflow } from "./research-pipeline";
import { dataProcessorWorkflow } from "./data-processor";
import { backupWorkflow } from "./backup";
import { multiSourceResearchWorkflow } from "./multi-source-research";
import { fileCleanupWorkflow } from "./file-cleanup";
import { batchImageProcessorWorkflow } from "./batch-image-processor";
import { urlMonitorWorkflow } from "./url-monitor";

// Export all workflows
export {
  webScraperWorkflow,
  fileOrganizerWorkflow,
  researchPipelineWorkflow,
  dataProcessorWorkflow,
  backupWorkflow,
  multiSourceResearchWorkflow,
  fileCleanupWorkflow,
  batchImageProcessorWorkflow,
  urlMonitorWorkflow,
};

// All workflows registry
export const workflows = {
  "web-scraper": webScraperWorkflow,
  "file-organizer": fileOrganizerWorkflow,
  "research-pipeline": researchPipelineWorkflow,
  "data-processor": dataProcessorWorkflow,
  "backup": backupWorkflow,
  "multi-source-research": multiSourceResearchWorkflow,
  "file-cleanup": fileCleanupWorkflow,
  "batch-image-processor": batchImageProcessorWorkflow,
  "url-monitor": urlMonitorWorkflow,
};

export type WorkflowId = keyof typeof workflows;
