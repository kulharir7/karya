/**
 * URL Monitor Workflow
 * 
 * Demonstrates: .dountil() loop — repeat until condition met
 * 
 * Steps:
 * 1. Check URL status
 * 2. LOOP: Keep checking until target status/content found
 * 3. Report final status
 * 
 * Use case: Wait for deployment, API availability, page content change
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Check result schema
const checkResultSchema = z.object({
  url: z.string(),
  attempt: z.number(),
  maxAttempts: z.number(),
  intervalMs: z.number(),
  targetStatus: z.number().optional(),
  targetContent: z.string().optional(),
  currentStatus: z.number(),
  currentContent: z.string(),
  found: z.boolean(),
  timestamp: z.number(),
  error: z.string().optional(),
});

// Step 1: Initial check setup
const setupCheckStep = createStep({
  id: "setup-check",
  inputSchema: z.object({
    url: z.string(),
    targetStatus: z.number().optional().default(200),
    targetContent: z.string().optional(),
    maxAttempts: z.number().optional().default(10),
    intervalMs: z.number().optional().default(5000),
  }),
  outputSchema: checkResultSchema,
  execute: async ({ inputData }) => {
    const { 
      url, 
      targetStatus = 200, 
      targetContent, 
      maxAttempts = 10, 
      intervalMs = 5000 
    } = inputData;
    
    try {
      const response = await fetch(url, { 
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "Karya-Monitor/1.0" },
      });
      
      const content = await response.text();
      const contentPreview = content.slice(0, 500);
      
      // Check if target found
      let found = false;
      if (targetContent) {
        found = content.includes(targetContent);
      } else {
        found = response.status === targetStatus;
      }
      
      return {
        url,
        attempt: 1,
        maxAttempts,
        intervalMs,
        targetStatus,
        targetContent,
        currentStatus: response.status,
        currentContent: contentPreview,
        found,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        url,
        attempt: 1,
        maxAttempts,
        intervalMs,
        targetStatus,
        targetContent,
        currentStatus: 0,
        currentContent: "",
        found: false,
        timestamp: Date.now(),
        error: err.message,
      };
    }
  },
});

// Step 2: Check again (loop step)
const checkAgainStep = createStep({
  id: "check-again",
  inputSchema: checkResultSchema,
  outputSchema: checkResultSchema,
  execute: async ({ inputData }) => {
    const { 
      url, 
      attempt, 
      maxAttempts, 
      intervalMs, 
      targetStatus, 
      targetContent 
    } = inputData;
    
    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    
    const newAttempt = attempt + 1;
    
    try {
      const response = await fetch(url, { 
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "Karya-Monitor/1.0" },
      });
      
      const content = await response.text();
      const contentPreview = content.slice(0, 500);
      
      // Check if target found
      let found = false;
      if (targetContent) {
        found = content.includes(targetContent);
      } else {
        found = response.status === (targetStatus || 200);
      }
      
      return {
        url,
        attempt: newAttempt,
        maxAttempts,
        intervalMs,
        targetStatus,
        targetContent,
        currentStatus: response.status,
        currentContent: contentPreview,
        found,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        url,
        attempt: newAttempt,
        maxAttempts,
        intervalMs,
        targetStatus,
        targetContent,
        currentStatus: 0,
        currentContent: "",
        found: false,
        timestamp: Date.now(),
        error: err.message,
      };
    }
  },
});

// Step 3: Generate report
const reportStep = createStep({
  id: "report",
  inputSchema: checkResultSchema,
  outputSchema: z.object({
    url: z.string(),
    success: z.boolean(),
    totalAttempts: z.number(),
    finalStatus: z.number(),
    duration: z.string(),
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { 
      url, 
      attempt, 
      maxAttempts,
      intervalMs,
      targetStatus,
      targetContent,
      currentStatus, 
      found,
      error,
    } = inputData;
    
    const durationMs = (attempt - 1) * intervalMs;
    const durationSec = (durationMs / 1000).toFixed(1);
    
    let summary = `## URL Monitor Report\n\n`;
    summary += `**URL:** ${url}\n`;
    summary += `**Target:** ${targetContent ? `Content "${targetContent}"` : `Status ${targetStatus}`}\n`;
    summary += `**Attempts:** ${attempt} / ${maxAttempts}\n`;
    summary += `**Duration:** ${durationSec}s\n\n`;
    
    if (found) {
      summary += `✅ **SUCCESS** — Target condition met!\n`;
      summary += `Final status: ${currentStatus}\n`;
    } else if (attempt >= maxAttempts) {
      summary += `❌ **TIMEOUT** — Max attempts reached\n`;
      summary += `Last status: ${currentStatus}\n`;
      if (error) summary += `Last error: ${error}\n`;
    } else {
      summary += `⚠️ **STOPPED** — Condition not met\n`;
    }
    
    return {
      url,
      success: found,
      totalAttempts: attempt,
      finalStatus: currentStatus,
      duration: `${durationSec}s`,
      summary,
    };
  },
});

// Create the workflow with DOUNTIL loop
export const urlMonitorWorkflow = createWorkflow({
  id: "url-monitor",
  inputSchema: z.object({
    url: z.string(),
    targetStatus: z.number().optional(),
    targetContent: z.string().optional(),
    maxAttempts: z.number().optional(),
    intervalMs: z.number().optional(),
  }),
  outputSchema: z.object({
    url: z.string(),
    success: z.boolean(),
    totalAttempts: z.number(),
    finalStatus: z.number(),
    duration: z.string(),
    summary: z.string(),
  }),
})
  .then(setupCheckStep)
  // DOUNTIL: Keep checking UNTIL found OR max attempts reached
  .dountil(
    checkAgainStep,
    async ({ inputData }) => inputData.found || inputData.attempt >= inputData.maxAttempts
  )
  .then(reportStep)
  .commit();
