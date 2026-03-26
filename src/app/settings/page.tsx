"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Settings {
  model: string;
  baseUrl: string;
}

interface MCPServer {
  id: string;
  name: string;
  url: string;
  transport: "sse" | "streamable-http";
  apiKey?: string;
  enabled: boolean;
}

interface MCPTestResult {
  success: boolean;
  toolCount: number;
  tools: string[];
  error?: string;
}

const MODELS = [
  { id: "gpt-oss:120b", name: "GPT-OSS 120B", speed: "⚡ Fast", desc: "Good general model" },
  { id: "qwen3-coder:480b", name: "Qwen3 Coder 480B", speed: "⏳ Medium", desc: "Best for code tasks" },
  { id: "deepseek-r1:671b", name: "DeepSeek R1 671B", speed: "🐢 Slow", desc: "Deep reasoning" },
  { id: "glm-5:cloud", name: "GLM-5 Cloud", speed: "⏳ Medium", desc: "Chinese language model" },
  { id: "qwen3:235b", name: "Qwen3 235B", speed: "⏳ Medium", desc: "Strong general purpose" },
  { id: "gemma3:27b", name: "Gemma 3 27B", speed: "⚡ Fast", desc: "Google's lightweight" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({ model: "gpt-oss:120b", baseUrl: "https://ollama.com/v1" });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // MCP State
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [mcpLoading, setMcpLoading] = useState(true);
  const [showAddMCP, setShowAddMCP] = useState(false);
  const [newMCP, setNewMCP] = useState({ name: "", url: "", transport: "streamable-http" as const, apiKey: "" });
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<MCPTestResult | null>(null);
  const [addTesting, setAddTesting] = useState(false);
  const [addTestResult, setAddTestResult] = useState<MCPTestResult | null>(null);

  // Load settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => { setSettings(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Load MCP servers
  useEffect(() => {
    fetch("/api/mcp")
      .then((r) => r.json())
      .then((d) => { setMcpServers(d.servers || []); setMcpLoading(false); })
      .catch(() => setMcpLoading(false));
  }, []);

  const saveSettings = async () => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // MCP Actions
  const addMCPServer = async () => {
    if (!newMCP.name.trim() || !newMCP.url.trim()) return;
    const res = await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ...newMCP }),
    });
    const data = await res.json();
    if (data.success) {
      setMcpServers(data.servers);
      setNewMCP({ name: "", url: "", transport: "streamable-http", apiKey: "" });
      setShowAddMCP(false);
      setAddTestResult(null);
    }
  };

  const removeMCPServer = async (id: string) => {
    const res = await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", id }),
    });
    const data = await res.json();
    if (data.success) setMcpServers(data.servers);
  };

  const toggleMCPServer = async (id: string) => {
    const res = await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id }),
    });
    const data = await res.json();
    if (data.success) setMcpServers(data.servers);
  };

  const testMCPServer = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", id }),
      });
      const result = await res.json();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, toolCount: 0, tools: [], error: err.message });
    }
    setTestingId(null);
  };

  const testNewMCPUrl = async () => {
    if (!newMCP.url.trim()) return;
    setAddTesting(true);
    setAddTestResult(null);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-url",
          url: newMCP.url,
          transport: newMCP.transport,
          apiKey: newMCP.apiKey,
        }),
      });
      const result = await res.json();
      setAddTestResult(result);
    } catch (err: any) {
      setAddTestResult({ success: false, toolCount: 0, tools: [], error: err.message });
    }
    setAddTesting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]">
        <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">← Back</Link>
            <span className="text-[var(--text-muted)]">·</span>
            <h1 className="text-sm font-semibold text-[var(--text-primary)]">Settings</h1>
          </div>
          <button
            onClick={saveSettings}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              saved
                ? "bg-green-100 text-green-700"
                : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
            }`}
          >
            {saved ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* === AI Model === */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            AI Model
          </h2>
          <div className="space-y-2">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSettings({ ...settings, model: m.id })}
                className={`w-full flex items-center justify-between p-3.5 rounded-lg border text-left transition-all ${
                  settings.model === m.id
                    ? "border-purple-400 bg-purple-50 ring-1 ring-purple-200"
                    : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-gray-300"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{m.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{m.desc}</p>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">{m.speed}</span>
              </button>
            ))}
          </div>
        </section>

        {/* === API Configuration === */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            API Configuration
          </h2>
          <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4">
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Base URL</label>
            <input
              type="text"
              value={settings.baseUrl}
              onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100"
            />
          </div>
        </section>

        {/* === MCP Servers === */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              MCP Servers
            </h2>
            <button
              onClick={() => setShowAddMCP(!showAddMCP)}
              className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
            >
              {showAddMCP ? "Cancel" : "+ Add Server"}
            </button>
          </div>

          {/* Add new server form */}
          {showAddMCP && (
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-purple-200 p-4 mb-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Server Name</label>
                  <input
                    type="text"
                    value={newMCP.name}
                    onChange={(e) => setNewMCP({ ...newMCP, name: e.target.value })}
                    placeholder="My MCP Server"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Transport</label>
                  <select
                    value={newMCP.transport}
                    onChange={(e) => setNewMCP({ ...newMCP, transport: e.target.value as any })}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-400"
                  >
                    <option value="streamable-http">Streamable HTTP</option>
                    <option value="sse">SSE (Legacy)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Server URL</label>
                <input
                  type="text"
                  value={newMCP.url}
                  onChange={(e) => setNewMCP({ ...newMCP, url: e.target.value })}
                  placeholder="http://localhost:3001/mcp"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">
                  API Key <span className="text-[var(--text-muted)]">(optional)</span>
                </label>
                <input
                  type="password"
                  value={newMCP.apiKey}
                  onChange={(e) => setNewMCP({ ...newMCP, apiKey: e.target.value })}
                  placeholder="Bearer token or API key"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Test result for new server */}
              {addTestResult && (
                <div
                  className={`rounded-lg p-3 text-xs ${
                    addTestResult.success
                      ? "bg-green-50 border border-green-200 text-green-700"
                      : "bg-red-50 border border-red-200 text-red-700"
                  }`}
                >
                  {addTestResult.success ? (
                    <>
                      <p className="font-medium">✅ Connected — {addTestResult.toolCount} tools found</p>
                      {addTestResult.tools.length > 0 && (
                        <p className="mt-1 text-[10px] opacity-80">
                          {addTestResult.tools.slice(0, 10).join(", ")}
                          {addTestResult.tools.length > 10 && ` +${addTestResult.tools.length - 10} more`}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-medium">❌ Failed: {addTestResult.error}</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={testNewMCPUrl}
                  disabled={!newMCP.url.trim() || addTesting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 transition-all"
                >
                  {addTesting ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                      Testing...
                    </span>
                  ) : (
                    "🔌 Test Connection"
                  )}
                </button>
                <button
                  onClick={addMCPServer}
                  disabled={!newMCP.name.trim() || !newMCP.url.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-all"
                >
                  Add Server
                </button>
              </div>
            </div>
          )}

          {/* Server list */}
          {mcpLoading ? (
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-8 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            </div>
          ) : mcpServers.length === 0 ? (
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-dashed border-[var(--border)] p-6 text-center">
              <p className="text-2xl mb-2">🔌</p>
              <p className="text-sm text-[var(--text-secondary)]">No MCP servers connected</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Add servers to extend Karya with external tools
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {mcpServers.map((server) => (
                <div
                  key={server.id}
                  className={`bg-[var(--bg-secondary)] rounded-lg border p-4 transition-all ${
                    server.enabled
                      ? "border-[var(--border)]"
                      : "border-[var(--border)] opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleMCPServer(server.id)}
                        className={`w-9 h-5 rounded-full transition-colors relative ${
                          server.enabled ? "bg-green-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            server.enabled ? "left-[18px]" : "left-0.5"
                          }`}
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {server.name}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                          {server.url}
                          <span className="ml-2 px-1 py-0.5 rounded bg-[var(--bg-primary)] text-[9px]">
                            {server.transport}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-3">
                      <button
                        onClick={() => testMCPServer(server.id)}
                        disabled={testingId === server.id}
                        className="px-2.5 py-1 rounded-md text-[10px] font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 transition-all"
                      >
                        {testingId === server.id ? (
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-purple-400 border-t-transparent animate-spin" />
                            Testing
                          </span>
                        ) : (
                          "Test"
                        )}
                      </button>
                      <button
                        onClick={() => removeMCPServer(server.id)}
                        className="px-2 py-1 rounded-md text-[10px] text-red-500 hover:bg-red-50 transition-all"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Test result inline */}
                  {testResult && testingId === null && testResult === testResult && (
                    <div
                      className={`mt-3 rounded-md p-2.5 text-xs ${
                        testResult.success
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {testResult.success
                        ? `✅ Connected — ${testResult.toolCount} tools: ${testResult.tools.slice(0, 5).join(", ")}${testResult.tools.length > 5 ? "..." : ""}`
                        : `❌ ${testResult.error}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-[var(--text-muted)] mt-2">
            MCP servers extend Karya with external tools. Connect to Cursor, Claude Desktop, or any MCP-compatible service.
          </p>
        </section>

        {/* === About === */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            About
          </h2>
          <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-1.5 text-sm text-[var(--text-secondary)]">
            <p>
              <span className="text-[var(--text-muted)]">Version</span>{" "}
              <span className="font-medium text-[var(--text-primary)]">1.0.0</span>
            </p>
            <p>
              <span className="text-[var(--text-muted)]">Stack</span>{" "}
              <span className="font-medium text-[var(--text-primary)]">Mastra + Stagehand + Next.js</span>
            </p>
            <p>
              <span className="text-[var(--text-muted)]">Tools</span>{" "}
              <span className="font-medium text-[var(--text-primary)]">
                32 built-in + {mcpServers.filter((s) => s.enabled).length} MCP servers
              </span>
            </p>
            <p>
              <span className="text-[var(--text-muted)]">MCP Server</span>{" "}
              <span className="font-medium text-[var(--text-primary)]">Port 3001 (32 tools exposed)</span>
            </p>
            <p>
              <span className="text-[var(--text-muted)]">GitHub</span>{" "}
              <a
                href="https://github.com/kulharir7/karya"
                target="_blank"
                className="text-purple-600 hover:underline"
              >
                kulharir7/karya
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
