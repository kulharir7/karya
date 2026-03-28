/**
 * System Extra Tools — disk, apps, network, battery
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// ---- disk-usage ----
export const diskUsageTool = createTool({
  id: "disk-usage",
  description: "Get disk usage information for all drives.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const { execSync } = await import("child_process");
      const output = execSync("wmic logicaldisk get size,freespace,caption", { encoding: "utf-8", timeout: 5000 });
      const lines = output.trim().split("\n").slice(1).filter((l) => l.trim());
      const drives = lines.map((line) => {
        const parts = line.trim().split(/\s+/);
        const drive = parts[0];
        const free = parseInt(parts[1]) || 0;
        const total = parseInt(parts[2]) || 0;
        const used = total - free;
        return {
          drive,
          total: `${(total / 1073741824).toFixed(1)} GB`,
          free: `${(free / 1073741824).toFixed(1)} GB`,
          used: `${(used / 1073741824).toFixed(1)} GB`,
          usedPercent: total > 0 ? Math.round((used / total) * 100) : 0,
        };
      });
      return { success: true, drives };
    } catch (err: any) {
      return { success: false, drives: [], error: err.message };
    }
  },
});

// ---- installed-apps ----
export const installedAppsTool = createTool({
  id: "installed-apps",
  description: "List installed applications on this computer.",
  inputSchema: z.object({
    search: z.string().optional().describe("Filter apps by name"),
  }),
  execute: async ({ search }) => {
    try {
      const { execSync } = await import("child_process");
      const cmd = search
        ? `Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object { $_.DisplayName -like '*${search}*' } | Select-Object DisplayName, DisplayVersion, Publisher | ConvertTo-Json`
        : `Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object { $_.DisplayName } | Select-Object DisplayName, DisplayVersion | Sort-Object DisplayName | Select-Object -First 50 | ConvertTo-Json`;
      const output = execSync(`powershell -command "${cmd}"`, { encoding: "utf-8", timeout: 10000 });
      const apps = JSON.parse(output || "[]");
      return { success: true, apps: Array.isArray(apps) ? apps : [apps], count: Array.isArray(apps) ? apps.length : 1 };
    } catch (err: any) {
      return { success: false, apps: [], count: 0, error: err.message };
    }
  },
});

// ---- set-reminder ----
export const setReminderTool = createTool({
  id: "set-reminder",
  description: "Set a reminder that triggers after specified minutes. Uses Windows toast notification.",
  inputSchema: z.object({
    message: z.string().describe("Reminder message"),
    minutes: z.number().describe("Minutes from now"),
  }),
  execute: async ({ message, minutes }) => {
    try {
      const ms = minutes * 60 * 1000;
      setTimeout(async () => {
        try {
          const { execSync } = await import("child_process");
          execSync(`powershell -command "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', 'Karya Reminder')"`, { timeout: 5000 });
        } catch {}
      }, ms);
      const triggerTime = new Date(Date.now() + ms).toLocaleTimeString();
      return { success: true, message, minutes, triggerAt: triggerTime };
    } catch (err: any) {
      return { success: false, message: err.message, minutes: 0, triggerAt: "" };
    }
  },
});

// ---- environment-vars ----
export const envVarsTool = createTool({
  id: "env-vars",
  description: "List or get environment variables. Useful for checking PATH, config, etc.",
  inputSchema: z.object({
    name: z.string().optional().describe("Specific var name (or omit for all)"),
    search: z.string().optional().describe("Search vars by name"),
  }),
  execute: async ({ name, search }) => {
    if (name) {
      return { success: true, name, value: process.env[name] || "(not set)" };
    }
    const vars = Object.entries(process.env)
      .filter(([k]) => !search || k.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 30)
      .map(([k, v]) => ({ name: k, value: v?.slice(0, 100) }));
    return { success: true, count: vars.length, vars };
  },
});
