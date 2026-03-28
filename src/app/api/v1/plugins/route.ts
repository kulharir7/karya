/**
 * GET  /api/v1/plugins — List all installed plugins with status
 * POST /api/v1/plugins — Install, uninstall, scaffold, toggle, reload
 * 
 * POST actions:
 *   { "action": "install", "path": "/path/to/plugin" }
 *   { "action": "uninstall", "id": "plugin-name" }
 *   { "action": "scaffold", "name": "My Plugin", "description": "...", "withTools": true }
 *   { "action": "toggle", "id": "plugin-name", "enabled": true }
 *   { "action": "reload" }  — Re-scan and load all plugins
 */

import { NextRequest } from "next/server";
import { apiGuard, handleCORS } from "@/lib/api-middleware";
import { apiOk, apiCreated, apiBadRequest, apiNotFound, apiServerError } from "@/lib/api-response";
import {
  loadAllPlugins,
  listInstalledPlugins,
  getInstalledPlugin,
  installFromPath,
  uninstallPlugin,
  scaffoldPlugin,
  togglePluginEnabled,
  getPluginRegistryStats,
} from "@/lib/plugin-registry";

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(req: NextRequest) {
  const guard = apiGuard(req, "plugins-list");
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const plugin = getInstalledPlugin(id);
      if (!plugin) return apiNotFound("Plugin");
      return apiOk(plugin);
    }

    return apiOk({
      plugins: listInstalledPlugins(),
      stats: getPluginRegistryStats(),
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
      case "install": {
        const { path: pluginPath } = body;
        if (!pluginPath) return apiBadRequest("path is required");
        const result = await installFromPath(pluginPath);
        if (!result.success) return apiBadRequest(result.error || "Install failed");
        return apiCreated({ pluginId: result.pluginId, installed: true });
      }

      case "uninstall": {
        const { id } = body;
        if (!id) return apiBadRequest("id is required");
        const result = uninstallPlugin(id);
        if (!result.success) return apiBadRequest(result.error || "Uninstall failed");
        return apiOk({ id, uninstalled: true });
      }

      case "scaffold": {
        const { name, description, withTools } = body;
        if (!name) return apiBadRequest("name is required");
        const result = scaffoldPlugin(name, description, withTools);
        if (!result.success) return apiBadRequest(result.error || "Scaffold failed");
        return apiCreated({ name, path: result.path });
      }

      case "toggle": {
        const { id, enabled } = body;
        if (!id) return apiBadRequest("id is required");
        const success = togglePluginEnabled(id, enabled);
        if (!success) return apiNotFound("Plugin");
        return apiOk({ id, toggled: true });
      }

      case "reload": {
        const result = await loadAllPlugins();
        return apiOk(result);
      }

      default:
        return apiBadRequest("action must be: install, uninstall, scaffold, toggle, reload");
    }
  } catch (err: any) {
    return apiServerError(err.message);
  }
}
