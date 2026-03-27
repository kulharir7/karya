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

// Export all workflows
export {
  webScraperWorkflow,
  fileOrganizerWorkflow,
  researchPipelineWorkflow,
  dataProcessorWorkflow,
  backupWorkflow,
};

// All workflows registry
export const workflows = {
  "web-scraper": webScraperWorkflow,
  "file-organizer": fileOrganizerWorkflow,
  "research-pipeline": researchPipelineWorkflow,
  "data-processor": dataProcessorWorkflow,
  "backup": backupWorkflow,
};

export type WorkflowId = keyof typeof workflows;
