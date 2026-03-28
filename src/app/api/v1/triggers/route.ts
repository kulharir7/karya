/**
 * GET  /api/v1/triggers — List all triggers with stats
 * POST /api/v1/triggers — Create, toggle, delete triggers
 * 
 * POST body examples:
 * 
 * Create file trigger:
 * {
 *   "action": "create",
 *   "type": "file",
 *   "name": "Downloads Watcher",
 *   "config": {
 *     "path": "C:\\Users\\kulha\\Downloads",
 *     "events": ["create"],
 *     "pattern": "\\.(pdf|docx|xlsx)$"
 *   },
 *   "taskAction": "A new file appeared in Downloads: {filename}. Categorize it and move to the right folder."
 * }
 * 
 * Create clipboard trigger:
 * {
 *   "action": "create",
 *   "type": "clipboard",
 *   "name": "URL Summarizer",
 *   "config": { "contentType": "url" },
 *   "taskAction": "I just copied this URL. Open it and give me a brief summary."
 * }
 * 
 * Create webhook trigger:
 * {
 *   "action": "create",
 *   "type": "webhook",
 *   "name": "GitHub Push",
 *   "config": { "secret": "my-secret-123" },
 *   "taskAction": "A new push was received on GitHub. Summarize the changes."
 * }
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import {
  apiOk,
  apiCreated,
  apiBadRequest,
  apiNotFound,
  apiServerError,
} from "@/lib/api-response";
import {
  createTrigger,
  listTriggers,
  getTrigger,
  toggleTrigger,
  deleteTrigger,
  getTriggerStats,
  type TriggerType,
} from "@/lib/triggers";
import {
  getExecutorStats,
  getExecutionHistory,
  getActiveExecutions,
} from "@/lib/trigger-executor";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "read");
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const id = searchParams.get("id");

    // Get specific trigger
    if (id) {
      const trigger = getTrigger(id);
      if (!trigger) return apiNotFound("Trigger");
      return apiOk(trigger);
    }

    // Stats
    if (action === "stats") {
      return apiOk({
        triggers: getTriggerStats(),
        executor: getExecutorStats(),
      });
    }

    // Execution history
    if (action === "history") {
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      return apiOk({
        history: getExecutionHistory(limit),
        active: getActiveExecutions(),
      });
    }

    // Active executions
    if (action === "active") {
      return apiOk({ active: getActiveExecutions() });
    }

    // Default: list all triggers
    const triggers = listTriggers();
    return apiOk({
      triggers,
      count: triggers.length,
      stats: getTriggerStats(),
    });
  } catch (err: any) {
    return apiServerError(err.message);
  }
}

export async function POST(req: NextRequest) {
  const guard = apiGuard(req, "write");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const { type, name, config = {}, taskAction } = body;

        if (!type || !["file", "clipboard", "webhook"].includes(type)) {
          return apiBadRequest("type must be 'file', 'clipboard', or 'webhook'");
        }
        if (!name || typeof name !== "string") {
          return apiBadRequest("name is required");
        }
        if (!taskAction || typeof taskAction !== "string") {
          return apiBadRequest("taskAction is required (the instruction for the agent)");
        }

        // Validate config based on type
        if (type === "file" && !config.path) {
          return apiBadRequest("config.path is required for file triggers");
        }

        const trigger = createTrigger(type as TriggerType, name, config, taskAction);

        // For webhooks, include the URL
        const result: any = { ...trigger };
        if (type === "webhook") {
          result.webhookUrl = `/api/v1/webhook/${trigger.id}`;
        }

        return apiCreated(result);
      }

      case "toggle": {
        const { id, enabled } = body;
        if (!id) return apiBadRequest("id is required");
        const success = toggleTrigger(id, enabled);
        if (!success) return apiNotFound("Trigger");
        return apiOk({ id, toggled: true });
      }

      case "delete": {
        const { id } = body;
        if (!id) return apiBadRequest("id is required");
        const success = deleteTrigger(id);
        if (!success) return apiNotFound("Trigger");
        return apiOk({ id, deleted: true });
      }

      default:
        return apiBadRequest("action must be 'create', 'toggle', or 'delete'");
    }
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
