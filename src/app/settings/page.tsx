"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type LLMProvider = "anthropic" | "openai" | "google" | "openrouter" | "ollama" | "custom";

interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKeys: {
    anthropic: string;
    openai: string;
    google: string;
    openrouter: string;
  };
  customProvider: {
    name: string;
    baseURL: string;
    apiKey: string;
  };
}

interface MCPServer {
  id: string;
  name: string;
  url: string;
  transport: "sse" | "streamable-http";
  apiKey?: string;
  enabled: boolean;
}

const PROVIDER_INFO: Record<LLMProvider, { name: string; icon: string; description: string }> = {
  anthropic: { name: "Anthropic", icon: "🤖", description: "Claude models (recommended)" },
  openai: { name: "OpenAI", icon: "🧠", description: "GPT-4, GPT-3.5, o1" },
  google: { name: "Google", icon: "✨", description: "Gemini models" },
  openrouter: { name: "OpenRouter", icon: "🌐", description: "Multi-provider gateway" },
  ollama: { name: "Ollama", icon: "🦙", description: "Local models" },
  custom: { name: "Custom", icon: "⚙️", description: "OpenAI-compatible API" },
};

const PROVIDER_MODELS: Record<LLMProvider, { id: string; name: string; speed: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", speed: "⚡ Fast" },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4", speed: "🧠 Smartest" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", speed: "⚡ Fast" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", speed: "⚡⚡ Fastest" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o", speed: "⚡ Fast" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", speed: "⚡⚡ Fastest" },
    { id: "o1", name: "o1 (Reasoning)", speed: "🧠 Deep" },
    { id: "o1-mini", name: "o1 Mini", speed: "⚡ Fast" },
  ],
  google: [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", speed: "⚡⚡ Fastest" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", speed: "🧠 Smart" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", speed: "⚡ Fast" },
  ],
  openrouter: [
    { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", speed: "⚡ Fast" },
    { id: "openai/gpt-4o", name: "GPT-4o", speed: "⚡ Fast" },
    { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash", speed: "⚡⚡ Fastest" },
    { id: "meta-llama/llama-3.3-70b", name: "Llama 3.3 70B", speed: "⚡ Fast" },
    { id: "deepseek/deepseek-chat-v3", name: "DeepSeek v3", speed: "💰 Cheap" },
  ],
  ollama: [
    { id: "llama3.3", name: "Llama 3.3", speed: "⚡ Local" },
    { id: "qwen2.5-coder", name: "Qwen 2.5 Coder", speed: "⚡ Local" },
    { id: "deepseek-coder-v2", name: "DeepSeek Coder", speed: "⚡ Local" },
  ],
  custom: [],
};

export default function SettingsPage() {
  // LLM State
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [hasKeys, setHasKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // API Key input
  const [showKeyInput, setShowKeyInput] = useState<LLMProvider | null>(null);
  const [newApiKey, setNewApiKey] = useState("");
  
  // Custom provider
  const [customName, setCustomName] = useState("");
  const [customURL, setCustomURL] = useState("");
  const [customKey, setCustomKey] = useState("");

  // MCP State
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [mcpLoading, setMcpLoading] = useState(true);

  // Load config
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data.config);
        setHasKeys(data.hasKeys || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load MCP servers
  useEffect(() => {
    fetch("/api/mcp")
      .then((r) => r.json())
      .then((data) => {
        setMcpServers(data.servers || []);
        setMcpLoading(false);
      })
      .catch(() => setMcpLoading(false));
  }, []);

  // Save provider
  const saveProvider = async (provider: LLMProvider, model: string) => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setProvider", provider, model }),
    });
    setConfig((c) => c ? { ...c, provider, model } : c);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Save API key
  const saveApiKey = async (provider: LLMProvider) => {
    if (!newApiKey) return;
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setApiKey", provider, apiKey: newApiKey }),
    });
    setHasKeys((h) => ({ ...h, [provider]: true }));
    setNewApiKey("");
    setShowKeyInput(null);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Save custom provider
  const saveCustomProvider = async () => {
    if (!customURL) return;
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "setCustomProvider",
        name: customName || "custom",
        baseURL: customURL,
        apiKey: customKey,
      }),
    });
    setConfig((c) => c ? { ...c, provider: "custom" } : c);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold">⚙️ Settings</h1>
        </div>
        {saved && (
          <div className="text-green-600 flex items-center gap-2">
            ✓ Saved
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* LLM Provider Section */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">🤖 AI Model Provider</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {(Object.keys(PROVIDER_INFO) as LLMProvider[]).map((provider) => {
              const info = PROVIDER_INFO[provider];
              const isActive = config?.provider === provider;
              const hasKey = hasKeys[provider] || provider === "ollama";
              
              return (
                <button
                  key={provider}
                  onClick={() => {
                    if (hasKey || provider === "custom") {
                      const models = PROVIDER_MODELS[provider];
                      const defaultModel = models[0]?.id || "";
                      saveProvider(provider, defaultModel);
                    } else {
                      setShowKeyInput(provider);
                    }
                  }}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    isActive
                      ? "border-purple-500 bg-purple-50"
                      : hasKey
                      ? "border-gray-200 hover:border-purple-300"
                      : "border-dashed border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{info.icon}</span>
                    <span className="font-medium">{info.name}</span>
                    {isActive && <span className="text-purple-600 text-xs">✓ Active</span>}
                  </div>
                  <div className="text-xs text-gray-500">{info.description}</div>
                  {!hasKey && provider !== "custom" && provider !== "ollama" && (
                    <div className="text-xs text-amber-600 mt-1">+ Add API key</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* API Key Input Modal */}
          {showKeyInput && showKeyInput !== "custom" && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">
                  🔑 Enter {PROVIDER_INFO[showKeyInput].name} API Key
                </h3>
                <button
                  onClick={() => setShowKeyInput(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder={showKeyInput === "anthropic" ? "sk-ant-api03-..." : "sk-..."}
                  className="flex-1 px-3 py-2 border rounded-lg font-mono text-sm"
                />
                <button
                  onClick={() => saveApiKey(showKeyInput)}
                  disabled={!newApiKey || saving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving ? "..." : "Save"}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {showKeyInput === "anthropic" && "Get key: console.anthropic.com/settings/keys"}
                {showKeyInput === "openai" && "Get key: platform.openai.com/api-keys"}
                {showKeyInput === "google" && "Get key: aistudio.google.com/apikey"}
                {showKeyInput === "openrouter" && "Get key: openrouter.ai/keys"}
              </p>
            </div>
          )}

          {/* Custom Provider Setup */}
          {config?.provider === "custom" && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border">
              <h3 className="font-medium mb-3">⚙️ Custom Provider Setup</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Provider name (e.g., ollama-cloud)"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={customURL}
                  onChange={(e) => setCustomURL(e.target.value)}
                  placeholder="Base URL (e.g., https://ollama.com/v1)"
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                />
                <input
                  type="password"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="API Key (optional)"
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                />
                <button
                  onClick={saveCustomProvider}
                  disabled={!customURL || saving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Custom Provider"}
                </button>
              </div>
            </div>
          )}

          {/* Change API Key Button (for active provider) */}
          {config?.provider && config.provider !== "custom" && config.provider !== "ollama" && !showKeyInput && (
            <div className="mb-4">
              <button
                onClick={() => setShowKeyInput(config.provider)}
                className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                🔑 {hasKeys[config.provider] ? "Change" : "Add"} {PROVIDER_INFO[config.provider]?.name} API Key
              </button>
            </div>
          )}

          {/* Model Selection */}
          {config?.provider && config.provider !== "custom" && PROVIDER_INFO[config.provider] && (
            <div>
              <h3 className="font-medium mb-3">
                📦 Select Model ({PROVIDER_INFO[config.provider]?.name || config.provider})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {(PROVIDER_MODELS[config.provider] || []).map((model) => (
                  <button
                    key={model.id}
                    onClick={() => saveProvider(config.provider, model.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      config.model === model.id
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 hover:border-purple-300"
                    }`}
                  >
                    <div className="font-medium text-sm">{model.name}</div>
                    <div className="text-xs text-gray-500">{model.speed}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current Config Display */}
          {config?.provider && (
            <div className="mt-6 pt-4 border-t text-sm text-gray-600">
              <strong>Current:</strong>{" "}
              {PROVIDER_INFO[config.provider]?.name || config.provider} → {config?.model || "not set"}
            </div>
          )}
        </section>

        {/* MCP Servers Section */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">🔌 MCP Servers</h2>
          
          {mcpLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : mcpServers.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No MCP servers configured.
              <br />
              <Link href="/help" className="text-purple-600 hover:underline">
                Learn how to add MCP servers →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {mcpServers.map((server) => (
                <div
                  key={server.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <div className="font-medium">{server.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{server.url}</div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${
                    server.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {server.enabled ? "ON" : "OFF"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick Info */}
        <section className="bg-gray-100 rounded-xl p-4 text-sm text-gray-600">
          <h3 className="font-semibold mb-2">💡 Tips</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li><strong>Anthropic Claude</strong> — Best for coding, recommended</li>
            <li><strong>OpenAI GPT-4o</strong> — Great all-around, fast</li>
            <li><strong>Google Gemini</strong> — Free tier available</li>
            <li><strong>OpenRouter</strong> — Access all models with one key</li>
            <li><strong>Ollama</strong> — Run locally, no API key needed</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
