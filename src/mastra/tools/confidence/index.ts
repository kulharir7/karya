/**
 * Confidence Scoring — Point 10
 * 
 * Agent rates its own confidence. Low confidence = ask user for clarification.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const confidenceCheckTool = createTool({
  id: "confidence-check",
  description: `Rate your confidence in understanding and completing the user's request.
Use this when:
- The request is ambiguous or unclear
- You're not sure which approach to take
- The task involves assumptions you need to verify

If confidence is below 0.5, ASK the user for clarification instead of guessing.
If confidence is 0.5-0.7, state your assumptions and proceed.
If confidence is above 0.7, proceed directly.`,
  inputSchema: z.object({
    task: z.string().describe("The user's request"),
    confidence: z.number().min(0).max(1).describe("Your confidence level (0.0 = no idea, 1.0 = completely clear)"),
    assumptions: z.array(z.string()).optional().describe("Assumptions you're making about the request"),
    clarificationNeeded: z.string().optional().describe("What you'd ask the user if confidence is low"),
  }),
  outputSchema: z.object({
    action: z.enum(["proceed", "clarify", "proceed-with-assumptions"]),
    confidence: z.number(),
    message: z.string(),
  }),
  execute: async ({ task, confidence, assumptions, clarificationNeeded }) => {
    if (confidence < 0.5) {
      return {
        action: "clarify" as const,
        confidence,
        message: clarificationNeeded
          ? `🤔 I'm not fully sure about this. ${clarificationNeeded}`
          : `🤔 I need more details about: "${task}". Can you clarify?`,
      };
    }

    if (confidence < 0.7 && assumptions && assumptions.length > 0) {
      return {
        action: "proceed-with-assumptions" as const,
        confidence,
        message: `Proceeding with assumptions: ${assumptions.join(", ")}`,
      };
    }

    return {
      action: "proceed" as const,
      confidence,
      message: `Clear — proceeding with confidence ${(confidence * 100).toFixed(0)}%`,
    };
  },
});
