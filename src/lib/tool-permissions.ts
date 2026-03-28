/**
 * Tool Permissions — Re-exports from security-engine.ts
 * 
 * Phase 8.3: This file is now a thin re-export layer.
 * All tool risk data lives in security-engine.ts (single source of truth).
 * 
 * Kept for backward compatibility with:
 * - /api/permissions/route.ts
 * - ToolCard.tsx (UI component)
 */

export type { RiskLevel, ToolRiskInfo } from "./security-engine";
export {
  TOOL_RISKS,
  RISK_LEVELS,
  getRiskLevel,
  getToolRiskInfo,
  requiresConfirmation,
  getToolsByRiskLevel as getToolsByRisk,
  getDangerousTools,
  getRiskDisplay,
  getPermissionStats,
} from "./security-engine";
