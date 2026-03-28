/**
 * Karya Custom Processors — Mastra agent pipeline
 * 
 * 1. StepControlProcessor — dynamic tool control per step
 * 2. SecurityFilterProcessor — filter prompt injection from input
 * 3. InputNormalizerProcessor — clean whitespace/unicode
 */

import type {
  Processor,
  ProcessInputArgs,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from "@mastra/core/processors";

// ============================================
// 1. STEP CONTROL PROCESSOR
// ============================================

export class StepControlProcessor implements Processor {
  id = "karya-step-control";

  async processInputStep({
    stepNumber,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    // After 8 steps: disable tools, force text response (prevent infinite loops)
    if (stepNumber > 8) {
      return { toolChoice: "none" as any };
    }
    return {};
  }
}

// ============================================
// 2. SECURITY FILTER PROCESSOR
// ============================================

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?above/i,
  /you\s+are\s+now\s+(?:a\s+)?(?:different|new|evil)/i,
  /forget\s+(?:all\s+)?(?:your|previous)\s+(?:instructions|rules)/i,
  /system\s*:\s*you\s+are/i,
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|system\|>/i,
  /pretend\s+(?:you\s+are|to\s+be)\s+(?:a\s+)?(?:different|unrestricted)/i,
  /bypass\s+(?:all\s+)?(?:safety|security|filters)/i,
  /jailbreak|DAN\s*mode|developer\s*mode/i,
];

export class SecurityFilterProcessor implements Processor {
  id = "karya-security-filter";

  async processInput({ messages }: ProcessInputArgs): Promise<any[]> {
    return messages.map((msg: any) => {
      if (msg.role !== "user") return msg;

      const text = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map((p: any) => p.text || "").join(" ")
          : "";

      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(text)) {
          console.warn(`[security-filter] Blocked injection: ${pattern.source}`);
          return {
            ...msg,
            content: "[Message filtered by security policy. Please rephrase your request.]",
          };
        }
      }
      return msg;
    });
  }
}

// ============================================
// 3. INPUT NORMALIZER PROCESSOR
// ============================================

export class InputNormalizerProcessor implements Processor {
  id = "karya-input-normalizer";

  async processInput({ messages }: ProcessInputArgs): Promise<any[]> {
    return messages.map((msg: any) => {
      if (msg.role !== "user" || typeof msg.content !== "string") return msg;
      let cleaned = msg.content;
      cleaned = cleaned.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, "");
      cleaned = cleaned.replace(/\s{3,}/g, "  ");
      cleaned = cleaned.trim();
      return { ...msg, content: cleaned };
    });
  }
}

// ============================================
// EXPORTS
// ============================================

export const stepControlProcessor = new StepControlProcessor();
export const securityFilterProcessor = new SecurityFilterProcessor();
export const inputNormalizerProcessor = new InputNormalizerProcessor();
