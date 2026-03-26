import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { execSync } from "child_process";

export const dateTimeTool = createTool({
  id: "system-datetime",
  description: "Get the current date, time, day of week, and timezone. Use when user asks 'what time is it' or 'aaj kya date hai'.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    date: z.string(),
    time: z.string(),
    day: z.string(),
    timezone: z.string(),
    iso: z.string(),
  }),
  execute: async () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }),
      time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      day: now.toLocaleDateString("en-IN", { weekday: "long" }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      iso: now.toISOString(),
    };
  },
});

export const processListTool = createTool({
  id: "system-processes",
  description: "List running processes on the computer. Use when user asks 'kya chal raha hai' or 'show running processes' or 'task manager'.",
  inputSchema: z.object({
    filter: z.string().optional().describe("Optional: filter by process name (e.g., 'chrome', 'node')"),
    top: z.number().optional().describe("Number of top processes to show (default: 15)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    processes: z.array(z.object({
      name: z.string(),
      pid: z.number(),
      memoryMB: z.number(),
    })),
    count: z.number(),
  }),
  execute: async ({ filter, top }) => {
    try {
      const limit = top || 15;
      let cmd = `Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First ${limit} Name,Id,@{N='MemMB';E={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json`;
      if (filter) {
        cmd = `Get-Process -Name *${filter}* -ErrorAction SilentlyContinue | Sort-Object WorkingSet64 -Descending | Select-Object Name,Id,@{N='MemMB';E={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json`;
      }
      const output = execSync(`powershell -Command "${cmd}"`, { encoding: "utf-8", timeout: 10000 });
      const data = JSON.parse(output);
      const list = Array.isArray(data) ? data : [data];
      return {
        success: true,
        processes: list.map((p: any) => ({ name: p.Name, pid: p.Id, memoryMB: p.MemMB })),
        count: list.length,
      };
    } catch (err: any) {
      return { success: false, processes: [], count: 0 };
    }
  },
});

export const openAppTool = createTool({
  id: "system-open-app",
  description: "Open an application, file, or URL on the computer. Use when user says 'open notepad', 'chrome kholo', 'calculator open karo', or any app/file to open.",
  inputSchema: z.object({
    target: z.string().describe("App name, file path, or URL to open (e.g., 'notepad', 'chrome', 'calculator', 'C:\\file.txt', 'https://google.com')"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ target }) => {
    try {
      execSync(`Start-Process "${target}"`, { shell: "powershell.exe", timeout: 5000 });
      return { success: true, message: `Opened: ${target}` };
    } catch (err: any) {
      return { success: false, message: `Failed to open ${target}: ${err.message}` };
    }
  },
});

export const killProcessTool = createTool({
  id: "system-kill-process",
  description: "Kill/stop a running process by name or PID. Use when user says 'close chrome', 'kill that process', 'stop notepad'.",
  inputSchema: z.object({
    target: z.string().describe("Process name (e.g., 'notepad', 'chrome') or PID number"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ target }) => {
    try {
      const isNum = /^\d+$/.test(target);
      const cmd = isNum
        ? `Stop-Process -Id ${target} -Force`
        : `Stop-Process -Name "${target}" -Force -ErrorAction SilentlyContinue`;
      execSync(`powershell -Command "${cmd}"`, { encoding: "utf-8", timeout: 5000 });
      return { success: true, message: `Killed: ${target}` };
    } catch (err: any) {
      return { success: false, message: `Failed: ${err.message}` };
    }
  },
});
