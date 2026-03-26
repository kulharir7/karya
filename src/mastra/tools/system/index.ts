import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { execSync } from "child_process";
import * as os from "os";

export const systemInfoTool = createTool({
  id: "system-info",
  description: "Get system information: OS, CPU, memory, disk space, username, etc.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    os: z.string(),
    platform: z.string(),
    hostname: z.string(),
    username: z.string(),
    cpus: z.number(),
    totalMemoryGB: z.number(),
    freeMemoryGB: z.number(),
    homeDir: z.string(),
    cwd: z.string(),
  }),
  execute: async () => {
    return {
      os: `${os.type()} ${os.release()}`,
      platform: os.platform(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      cpus: os.cpus().length,
      totalMemoryGB: Math.round(os.totalmem() / 1073741824 * 10) / 10,
      freeMemoryGB: Math.round(os.freemem() / 1073741824 * 10) / 10,
      homeDir: os.homedir(),
      cwd: process.cwd(),
    };
  },
});

export const clipboardReadTool = createTool({
  id: "clipboard-read",
  description: "Read the current contents of the system clipboard.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string(),
  }),
  execute: async () => {
    try {
      const content = execSync("powershell Get-Clipboard", {
        encoding: "utf-8",
      }).trim();
      return { success: true, content };
    } catch {
      return { success: false, content: "" };
    }
  },
});

export const clipboardWriteTool = createTool({
  id: "clipboard-write",
  description: "Write text to the system clipboard.",
  inputSchema: z.object({
    text: z.string().describe("Text to copy to clipboard"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    try {
      const escaped = context.text.replace(/'/g, "''");
      execSync(`powershell "Set-Clipboard -Value '${escaped}'"`, {
        encoding: "utf-8",
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  },
});

export const notifyTool = createTool({
  id: "system-notify",
  description: "Show a desktop notification to the user.",
  inputSchema: z.object({
    title: z.string().describe("Notification title"),
    message: z.string().describe("Notification message"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    try {
      const script = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $template = '<toast><visual><binding template="ToastText02"><text id="1">${context.title}</text><text id="2">${context.message}</text></binding></visual></toast>'
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Karya AI").Show($toast)
      `;
      execSync(`powershell -Command "${script.replace(/\n/g, " ")}"`, {
        encoding: "utf-8",
      });
      return { success: true };
    } catch {
      // Fallback: simple msg box
      try {
        execSync(
          `powershell "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${context.message}', '${context.title}')"`,
          { encoding: "utf-8" }
        );
        return { success: true };
      } catch {
        return { success: false };
      }
    }
  },
});
