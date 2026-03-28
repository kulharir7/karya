/**
 * Web Tools — URL fetching, screenshots, HTTP requests
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// ---- web-fetch: URL → text/markdown ----
export const webFetchTool = createTool({
  id: "web-fetch",
  description: "Fetch a URL and extract readable content as text/markdown. Use for reading articles, docs, pages without browser.",
  inputSchema: z.object({
    url: z.string().describe("URL to fetch"),
    maxChars: z.number().optional().describe("Max characters to return (default 5000)"),
  }),
  execute: async ({ url, maxChars }) => {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(15000),
      });
      const html = await res.text();
      // Simple HTML to text extraction
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxChars || 5000);
      return { success: true, url, length: text.length, content: text };
    } catch (err: any) {
      return { success: false, url, length: 0, content: "", error: err.message };
    }
  },
});

// ---- http-request: Advanced HTTP with method/headers/body ----
export const httpRequestTool = createTool({
  id: "http-request",
  description: "Make advanced HTTP requests (GET/POST/PUT/DELETE) with custom headers and body. Use for API calls, webhooks, testing endpoints.",
  inputSchema: z.object({
    url: z.string().describe("Request URL"),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional().describe("HTTP method (default GET)"),
    headers: z.record(z.string(), z.string()).optional().describe("Custom headers"),
    body: z.string().optional().describe("Request body (JSON string)"),
    timeout: z.number().optional().describe("Timeout in seconds (default 15)"),
  }),
  execute: async ({ url, method, headers, body, timeout }) => {
    try {
      const res = await fetch(url, {
        method: method || "GET",
        headers: { "Content-Type": "application/json", ...headers },
        body: body || undefined,
        signal: AbortSignal.timeout((timeout || 15) * 1000),
      });
      const responseText = await res.text();
      let responseJson: any = null;
      try { responseJson = JSON.parse(responseText); } catch {}
      return {
        success: res.ok,
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: responseJson || responseText.slice(0, 5000),
      };
    } catch (err: any) {
      return { success: false, status: 0, statusText: "", headers: {}, body: err.message };
    }
  },
});

// ---- dns-lookup ----
export const dnsLookupTool = createTool({
  id: "dns-lookup",
  description: "Look up DNS records for a domain. Returns IP addresses.",
  inputSchema: z.object({
    domain: z.string().describe("Domain to look up (e.g., google.com)"),
  }),
  execute: async ({ domain }) => {
    try {
      const dns = await import("dns");
      const { promisify } = await import("util");
      const resolve4 = promisify(dns.resolve4);
      const ips = await resolve4(domain);
      return { success: true, domain, addresses: ips };
    } catch (err: any) {
      return { success: false, domain, addresses: [], error: err.message };
    }
  },
});

// ---- ping ----
export const pingTool = createTool({
  id: "ping",
  description: "Ping a host to check if it's reachable and measure latency.",
  inputSchema: z.object({
    host: z.string().describe("Host to ping (IP or domain)"),
  }),
  execute: async ({ host }) => {
    try {
      const { execSync } = await import("child_process");
      const output = execSync(`ping -n 3 ${host}`, { encoding: "utf-8", timeout: 10000 });
      const avgMatch = output.match(/Average\s*=\s*(\d+)/);
      return { success: true, host, output: output.slice(0, 1000), avgMs: avgMatch ? parseInt(avgMatch[1]) : null };
    } catch (err: any) {
      return { success: false, host, output: err.message, avgMs: null };
    }
  },
});

// ---- network-info ----
export const networkInfoTool = createTool({
  id: "network-info",
  description: "Get network information: IP addresses, interfaces, WiFi status.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const os = await import("os");
      const interfaces = os.networkInterfaces();
      const result: any[] = [];
      for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;
        for (const addr of addrs) {
          if (!addr.internal) {
            result.push({ interface: name, address: addr.address, family: addr.family, mac: addr.mac });
          }
        }
      }
      return { success: true, interfaces: result };
    } catch (err: any) {
      return { success: false, interfaces: [], error: err.message };
    }
  },
});
