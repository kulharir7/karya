/**
 * GET  /api/v1/security — Security status, stats, blocked log
 * POST /api/v1/security — Update security config
 * 
 * GET query params:
 *   ?action=config — Get current security config
 *   ?action=blocked — Get blocked attempts log
 *   ?action=stats — Get security stats
 * 
 * POST body:
 *   { "action": "update", "config": { ... } }
 *   { "action": "block-tool", "toolName": "kill-process" }
 *   { "action": "unblock-tool", "toolName": "kill-process" }
 *   { "action": "add-blocked-path", "path": "C:\\SensitiveDir" }
 *   { "action": "remove-blocked-path", "path": "C:\\SensitiveDir" }
 *   { "action": "check-command", "command": "rm -rf /" }
 *   { "action": "check-path", "path": "C:\\Windows\\System32", "operation": "write" }
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiBadRequest, apiServerError } from "@/lib/api-response";
import {
  getSecurityConfig,
  saveSecurityConfig,
  getSecurityStats,
  getBlockedLog,
  checkCommand,
  checkPath,
  fullSecurityCheck,
} from "@/lib/security-engine";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "status");
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "overview";

    if (action === "config") {
      return apiOk(getSecurityConfig());
    }

    if (action === "blocked") {
      const limit = parseInt(searchParams.get("limit") || "50", 10);
      return apiOk({ blocked: getBlockedLog(limit) });
    }

    if (action === "stats") {
      return apiOk(getSecurityStats());
    }

    // Default: overview
    return apiOk({
      stats: getSecurityStats(),
      config: getSecurityConfig(),
      recentBlocked: getBlockedLog(10),
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "admin");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "update": {
        if (!body.config) return apiBadRequest("config object required");
        saveSecurityConfig(body.config);
        return apiOk({ updated: true, config: getSecurityConfig() });
      }

      case "block-tool": {
        const { toolName } = body;
        if (!toolName) return apiBadRequest("toolName required");
        const cfg = getSecurityConfig();
        if (!cfg.blockedTools.includes(toolName)) {
          cfg.blockedTools.push(toolName);
          saveSecurityConfig(cfg);
        }
        return apiOk({ blocked: toolName });
      }

      case "unblock-tool": {
        const { toolName } = body;
        if (!toolName) return apiBadRequest("toolName required");
        const cfg = getSecurityConfig();
        cfg.blockedTools = cfg.blockedTools.filter((t) => t !== toolName);
        saveSecurityConfig(cfg);
        return apiOk({ unblocked: toolName });
      }

      case "add-blocked-path": {
        const { path: blockedPath } = body;
        if (!blockedPath) return apiBadRequest("path required");
        const cfg = getSecurityConfig();
        if (!cfg.blockedPaths.includes(blockedPath)) {
          cfg.blockedPaths.push(blockedPath);
          saveSecurityConfig(cfg);
        }
        return apiOk({ added: blockedPath });
      }

      case "remove-blocked-path": {
        const { path: removePath } = body;
        if (!removePath) return apiBadRequest("path required");
        const cfg = getSecurityConfig();
        cfg.blockedPaths = cfg.blockedPaths.filter((p) => p !== removePath);
        saveSecurityConfig(cfg);
        return apiOk({ removed: removePath });
      }

      case "check-command": {
        const { command } = body;
        if (!command) return apiBadRequest("command required");
        return apiOk(checkCommand(command));
      }

      case "check-path": {
        const { path: checkPathStr, operation } = body;
        if (!checkPathStr) return apiBadRequest("path required");
        return apiOk(checkPath(checkPathStr, operation || "read"));
      }

      default:
        return apiBadRequest("action must be: update, block-tool, unblock-tool, add-blocked-path, remove-blocked-path, check-command, check-path");
    }
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
