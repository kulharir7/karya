import { MCPServer } from "@mastra/mcp";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as os from "os";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Official Mastra MCPServer — exposes Karya tools to other MCP clients
// (Cursor, Windsurf, Claude Desktop, other agents can connect)

const systemInfoMCP = createTool({
  id: "karya-system-info",
  description: "Get system information (OS, CPU, RAM, hostname, username)",
  inputSchema: z.object({}),
  outputSchema: z.object({
    os: z.string(), hostname: z.string(), username: z.string(),
    cpus: z.number(), totalMemoryGB: z.number(), freeMemoryGB: z.number(),
  }),
  execute: async () => ({
    os: `${os.type()} ${os.release()}`,
    hostname: os.hostname(),
    username: os.userInfo().username,
    cpus: os.cpus().length,
    totalMemoryGB: Math.round((os.totalmem() / 1073741824) * 10) / 10,
    freeMemoryGB: Math.round((os.freemem() / 1073741824) * 10) / 10,
  }),
});

const webSearchMCP = createTool({
  id: "karya-web-search",
  description: "Search the web via DuckDuckGo. Returns top 5 results.",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
  }),
  outputSchema: z.object({
    results: z.array(z.string()),
  }),
  execute: async ({ query }) => {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const results: string[] = [];
    const regex = /<a[^>]*class="result__a"[^>]*>(.*?)<\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null && results.length < 5) {
      results.push(match[1].replace(/<[^>]*>/g, "").trim());
    }
    return { results };
  },
});

const executeCommandMCP = createTool({
  id: "karya-execute-command",
  description: "Execute a shell command on the host (PowerShell on Windows)",
  inputSchema: z.object({
    command: z.string().describe("Command to execute"),
  }),
  outputSchema: z.object({
    success: z.boolean(), output: z.string(),
  }),
  execute: async ({ command }) => {
    try {
      const output = execSync(command, { encoding: "utf-8", timeout: 15000, shell: "powershell.exe" });
      return { success: true, output: output.slice(0, 5000) };
    } catch (err: any) {
      return { success: false, output: err.message };
    }
  },
});

const readFileMCP = createTool({
  id: "karya-read-file",
  description: "Read contents of a text file",
  inputSchema: z.object({
    filePath: z.string().describe("Path to the file"),
  }),
  outputSchema: z.object({
    success: z.boolean(), content: z.string(),
  }),
  execute: async ({ filePath }) => {
    try {
      const content = fs.readFileSync(path.resolve(filePath), "utf-8");
      return { success: true, content: content.slice(0, 30000) };
    } catch (err: any) {
      return { success: false, content: err.message };
    }
  },
});

const writeFileMCP = createTool({
  id: "karya-write-file",
  description: "Write content to a file (creates directories if needed)",
  inputSchema: z.object({
    filePath: z.string().describe("File path"),
    content: z.string().describe("Content to write"),
  }),
  outputSchema: z.object({
    success: z.boolean(), path: z.string(),
  }),
  execute: async ({ filePath, content }) => {
    try {
      const resolved = path.resolve(filePath);
      const dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(resolved, content);
      return { success: true, path: resolved };
    } catch (err: any) {
      return { success: false, path: err.message };
    }
  },
});

export function createKaryaMCPServer() {
  return new MCPServer({
    name: "karya",
    version: "0.1.0",
    tools: {
      systemInfoMCP,
      webSearchMCP,
      executeCommandMCP,
      readFileMCP,
      writeFileMCP,
    },
  });
}
