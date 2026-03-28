"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type LLMProvider = "anthropic" | "openai" | "google" | "openrouter" | "ollama" | "ollama-cloud" | "custom";

interface SettingsConfig {
  provider: LLMProvider;
  model: string;
  modelParams?: Record<string, any>;
  anthropic?: {
    authMethod: "api-key" | "setup-token";
    hasSetupToken: boolean;
  };
  customProvider?: {
    name: string;
    baseURL: string;
    hasApiKey: boolean;
  };
  hasKeys: Record<string, boolean>;
  keyPreviews: Record<string, string | null>;
}

const PROVIDER_INFO: Record<LLMProvider, { name: string; icon: string; description: string }> = {
  anthropic: { name: "Anthropic", icon: "🤖", description: "Claude models (recommended)" },
  openai: { name: "OpenAI", icon: "🧠", description: "GPT-4, o1, o3" },
  google: { name: "Google", icon: "✨", description: "Gemini models" },
  openrouter: { name: "OpenRouter", icon: "🌐", description: "All models, one key" },
  ollama: { name: "Ollama", icon: "🦙", description: "Local models" },
  "ollama-cloud": { name: "Ollama Cloud", icon: "☁️", description: "Remote Ollama (ollama.com)" },
  custom: { name: "Custom", icon: "⚙️", description: "OpenAI-compatible" },
};

const PROVIDER_MODELS: Record<LLMProvider, { id: string; name: string; description: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "⚡ Fast, best value" },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4", description: "🧠 Most capable" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "⚡ Previous gen" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", description: "⚡⚡ Fastest" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o", description: "⚡ Multimodal" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "⚡⚡ Cheapest" },
    { id: "o1", name: "o1", description: "🧠 Deep reasoning" },
    { id: "o3-mini", name: "o3 Mini", description: "🧠 Latest" },
  ],
  google: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "🧠 Most capable" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "⚡⚡ Ultra fast" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "⚡ Fast" },
  ],
  openrouter: [
    { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", description: "via OpenRouter" },
    { id: "openai/gpt-4o", name: "GPT-4o", description: "via OpenRouter" },
    { id: "deepseek/deepseek-r1", name: "DeepSeek R1", description: "💰 Cheap" },
    { id: "meta-llama/llama-3.3-70b", name: "Llama 3.3", description: "🦙 Open" },
  ],
  ollama: [
    { id: "llama3.3", name: "Llama 3.3", description: "🦙 Local" },
    { id: "qwen2.5-coder:32b", name: "Qwen Coder", description: "💻 Code" },
  ],
  "ollama-cloud": [
    { id: "qwen3-coder:480b", name: "Qwen 3 Coder 480B", description: "💻 Code (cloud)" },
    { id: "gpt-oss:120b", name: "GPT-OSS 120B", description: "🧠 General (cloud)" },
    { id: "kimi-k2.5:cloud", name: "Kimi K2.5", description: "⚡ Fast (cloud)" },
    { id: "deepseek-r1:cloud", name: "DeepSeek R1", description: "🧠 Reasoning (cloud)" },
  ],
  custom: [],
};

export default function SettingsPage() {
  // Config state
  const [config, setConfig] = useState<SettingsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  
  // Auth input state
  const [showAuthModal, setShowAuthModal] = useState<LLMProvider | null>(null);
  const [authMethod, setAuthMethod] = useState<"api-key" | "setup-token">("api-key");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [setupTokenInput, setSetupTokenInput] = useState("");
  
  // Custom provider state
  const [customName, setCustomName] = useState("");
  const [customURL, setCustomURL] = useState("");
  const [customKey, setCustomKey] = useState("");
  
  // Model params state
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"model" | "auth" | "security" | "plugins" | "mcp" | "about">("model");
  
  // Auth state
  const [authProviders, setAuthProviders] = useState<any[]>([]);
  const [authProfiles, setAuthProfiles] = useState<any[]>([]);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  
  // Security state
  const [securityConfig, setSecurityConfig] = useState<any>(null);
  const [plugins, setPlugins] = useState<any[]>([]);
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [mcpNewUrl, setMcpNewUrl] = useState("");
  const [mcpNewName, setMcpNewName] = useState("");
  
  // Load security + plugins + auth on tab switch
  useEffect(() => {
    if (activeTab === "auth" && authProviders.length === 0) {
      fetch("/api/v1/auth").then(r => r.json()).then(d => {
        setAuthProviders(d.data?.providers || []);
        setAuthProfiles(d.data?.profiles || []);
      }).catch(() => {});
    }
    if (activeTab === "security" && !securityConfig) {
      fetch("/api/v1/security?action=config").then(r => r.json()).then(d => setSecurityConfig(d.data)).catch(() => {});
    }
    if (activeTab === "plugins" && plugins.length === 0) {
      fetch("/api/v1/plugins").then(r => r.json()).then(d => setPlugins(d.data?.plugins || [])).catch(() => {});
    }
    if (activeTab === "mcp" && mcpServers.length === 0) {
      fetch("/api/v1/mcp/servers").then(r => r.json()).then(d => setMcpServers(d.data?.servers || d.servers || [])).catch(() => {});
    }
  }, [activeTab, authProviders.length, securityConfig, plugins.length, mcpServers.length]);

  // Load config
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch((e) => {
        setError("Failed to load settings");
        setLoading(false);
      });
  }, []);

  const showSuccess = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Save provider
  const saveProvider = async (provider: LLMProvider, model: string) => {
    setSaving(true);
    setError("");
    
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setProvider", provider, model }),
      });
      
      if (!res.ok) throw new Error("Failed to save");
      
      setConfig((c) => c ? { ...c, provider, model } : c);
      showSuccess();
    } catch (e: any) {
      setError(e.message);
    }
    
    setSaving(false);
  };

  // Save API key
  const saveApiKey = async () => {
    if (!showAuthModal || !apiKeyInput) return;
    
    setSaving(true);
    setError("");
    
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setApiKey", provider: showAuthModal, apiKey: apiKeyInput }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      
      setConfig((c) => c ? { 
        ...c, 
        hasKeys: { ...c.hasKeys, [showAuthModal]: true },
        keyPreviews: { ...c.keyPreviews, [showAuthModal]: "***" + apiKeyInput.slice(-4) }
      } : c);
      
      setApiKeyInput("");
      setShowAuthModal(null);
      showSuccess();
    } catch (e: any) {
      setError(e.message);
    }
    
    setSaving(false);
  };

  // ════════════════════════════════════════════════════════════════
  // AUTH TAB HANDLERS
  // ════════════════════════════════════════════════════════════════
  
  const addAuthKey = async (provider: string, key: string) => {
    setOauthLoading(provider);
    try {
      const res = await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-key", provider, apiKey: key }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || "Failed to add key");
      
      // Refresh auth list
      const refreshRes = await fetch("/api/v1/auth");
      const refreshData = await refreshRes.json();
      setAuthProviders(refreshData.data?.providers || []);
      setAuthProfiles(refreshData.data?.profiles || []);
      showSuccess();
    } catch (e: any) {
      setError(e.message);
    }
    setOauthLoading(null);
  };

  const startOAuth = async (provider: string) => {
    setOauthLoading(provider);
    try {
      const res = await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start-oauth", provider }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || "Failed to start OAuth");
      
      // Open auth URL in new window
      const authWindow = window.open(data.data.authUrl, "_blank", "width=600,height=700");
      
      // Wait for callback
      const waitRes = await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "wait-oauth", timeoutMs: 120000 }),
      });
      const waitData = await waitRes.json();
      
      if (waitData.ok && waitData.data?.profile) {
        // Refresh auth list
        const refreshRes = await fetch("/api/v1/auth");
        const refreshData = await refreshRes.json();
        setAuthProviders(refreshData.data?.providers || []);
        setAuthProfiles(refreshData.data?.profiles || []);
        showSuccess();
      } else {
        throw new Error(waitData.error?.message || "OAuth failed");
      }
    } catch (e: any) {
      setError(e.message);
    }
    setOauthLoading(null);
  };

  const removeProfile = async (profileId: string) => {
    try {
      await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", profileId }),
      });
      setAuthProfiles(authProfiles.filter(p => p.id !== profileId));
    } catch {}
  };

  // Save Anthropic setup token
  const saveSetupToken = async () => {
    if (!setupTokenInput) return;
    
    setSaving(true);
    setError("");
    
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setSetupToken", token: setupTokenInput }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      
      setConfig((c) => c ? {
        ...c,
        hasKeys: { ...c.hasKeys, anthropic: true },
        anthropic: { authMethod: "setup-token", hasSetupToken: true }
      } : c);
      
      setSetupTokenInput("");
      setShowAuthModal(null);
      showSuccess();
    } catch (e: any) {
      setError(e.message);
    }
    
    setSaving(false);
  };

  // Save custom provider
  const saveCustomProvider = async () => {
    if (!customURL) return;
    
    setSaving(true);
    setError("");
    
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "setCustomProvider", 
          name: customName || "custom",
          baseURL: customURL,
          apiKey: customKey 
        }),
      });
      
      if (!res.ok) throw new Error("Failed to save");
      
      setConfig((c) => c ? { ...c, provider: "custom" } : c);
      showSuccess();
    } catch (e: any) {
      setError(e.message);
    }
    
    setSaving(false);
  };

  // Save model params
  const saveModelParams = async (model: string, params: any) => {
    setSaving(true);
    
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setModelParams", model, params }),
      });
      
      setConfig((c) => c ? {
        ...c,
        modelParams: { ...c.modelParams, [model]: params }
      } : c);
      
      showSuccess();
    } catch (e) {
      setError("Failed to save params");
    }
    
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600">← Back</Link>
          <h1 className="text-xl font-semibold">⚙️ Settings</h1>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-red-600 text-sm">{error}</span>}
          {saved && <span className="text-green-600 text-sm flex items-center gap-1">✓ Saved</span>}
          {saving && <span className="text-gray-500 text-sm">Saving...</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-6 pt-4">
        <div className="flex gap-1 border-b border-gray-200">
          {(["model", "auth", "security", "plugins", "mcp", "about"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab ? "bg-white border border-b-white border-gray-200 -mb-px text-purple-600" : "text-gray-500 hover:text-gray-700"
              }`}>
              {{ model: "🤖 Model", auth: "🔐 Auth", security: "🔒 Security", plugins: "🔌 Plugins", mcp: "🔗 MCP", about: "ℹ️ About" }[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">

        {/* ========== MODEL TAB ========== */}
        {activeTab === "model" && <>
        
        {/* Provider Selection */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">🤖 AI Provider</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {(Object.keys(PROVIDER_INFO) as LLMProvider[]).map((provider) => {
              const info = PROVIDER_INFO[provider];
              const isActive = config?.provider === provider;
              const hasAuth = config?.hasKeys?.[provider];
              
              return (
                <button
                  key={provider}
                  onClick={() => {
                    if (hasAuth || provider === "ollama") {
                      const models = PROVIDER_MODELS[provider];
                      saveProvider(provider, models[0]?.id || config?.model || "");
                    } else if (provider === "custom") {
                      saveProvider("custom", "");
                    } else {
                      setShowAuthModal(provider);
                      setAuthMethod("api-key");
                    }
                  }}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    isActive
                      ? "border-purple-500 bg-purple-50"
                      : hasAuth
                      ? "border-gray-200 hover:border-purple-300"
                      : "border-dashed border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{info.icon}</span>
                    <span className="font-medium">{info.name}</span>
                    {isActive && <span className="text-purple-600 text-xs">✓</span>}
                  </div>
                  <div className="text-xs text-gray-500">{info.description}</div>
                  {!hasAuth && provider !== "ollama" && provider !== "custom" && (
                    <div className="text-xs text-amber-600 mt-1">+ Add credentials</div>
                  )}
                  {hasAuth && config?.keyPreviews?.[provider] && (
                    <div className="text-xs text-green-600 mt-1 font-mono">
                      {config.keyPreviews[provider]}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Auth Modal */}
          {showAuthModal && showAuthModal !== "custom" && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">
                  🔑 {PROVIDER_INFO[showAuthModal].name} Authentication
                </h3>
                <button onClick={() => setShowAuthModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              
              {/* Anthropic has two auth methods */}
              {showAuthModal === "anthropic" && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setAuthMethod("api-key")}
                    className={`px-3 py-1.5 rounded text-sm ${
                      authMethod === "api-key" ? "bg-purple-600 text-white" : "bg-gray-200"
                    }`}
                  >
                    API Key
                  </button>
                  <button
                    onClick={() => setAuthMethod("setup-token")}
                    className={`px-3 py-1.5 rounded text-sm ${
                      authMethod === "setup-token" ? "bg-purple-600 text-white" : "bg-gray-200"
                    }`}
                  >
                    Setup Token (Subscription)
                  </button>
                </div>
              )}
              
              {authMethod === "api-key" ? (
                <div className="space-y-3">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={
                      showAuthModal === "anthropic" ? "sk-ant-api03-..." :
                      showAuthModal === "openai" ? "sk-..." :
                      "API Key"
                    }
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                      {showAuthModal === "anthropic" && (
                        <a href="https://console.anthropic.com/settings/keys" target="_blank" className="text-purple-600 hover:underline">
                          Get API key →
                        </a>
                      )}
                      {showAuthModal === "openai" && (
                        <a href="https://platform.openai.com/api-keys" target="_blank" className="text-purple-600 hover:underline">
                          Get API key →
                        </a>
                      )}
                      {showAuthModal === "google" && (
                        <a href="https://aistudio.google.com/apikey" target="_blank" className="text-purple-600 hover:underline">
                          Get API key →
                        </a>
                      )}
                      {showAuthModal === "openrouter" && (
                        <a href="https://openrouter.ai/keys" target="_blank" className="text-purple-600 hover:underline">
                          Get API key →
                        </a>
                      )}
                    </p>
                    <button
                      onClick={saveApiKey}
                      disabled={!apiKeyInput || saving}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {saving ? "..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-2">
                    Use your Claude subscription. Run <code className="bg-gray-200 px-1 rounded">claude setup-token</code> to get a token.
                  </p>
                  <input
                    type="password"
                    value={setupTokenInput}
                    onChange={(e) => setSetupTokenInput(e.target.value)}
                    placeholder="Paste setup token here..."
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={saveSetupToken}
                      disabled={!setupTokenInput || saving}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {saving ? "..." : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Change Key Button */}
          {config?.provider && config.hasKeys?.[config.provider] && !showAuthModal && config.provider !== "ollama" && config.provider !== "custom" && (
            <button
              onClick={() => {
                setShowAuthModal(config.provider);
                setAuthMethod("api-key");
              }}
              className="text-sm text-purple-600 hover:text-purple-800 mb-4"
            >
              🔑 Change {PROVIDER_INFO[config.provider].name} credentials
            </button>
          )}

          {/* Custom Provider Setup */}
          {config?.provider === "custom" && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border">
              <h3 className="font-medium mb-3">⚙️ Custom Provider (OpenAI-compatible)</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Name (e.g., ollama-cloud)"
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
                  {saving ? "..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Model Selection */}
          {config?.provider && config.provider !== "custom" && PROVIDER_MODELS[config.provider]?.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium mb-3">📦 Model</h3>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDER_MODELS[config.provider].map((model) => (
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
                    <div className="text-xs text-gray-500">{model.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current Status */}
          <div className="mt-6 pt-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <strong>Active:</strong> {PROVIDER_INFO[config?.provider || "anthropic"]?.name} → {config?.model || "none"}
            </div>
            
            {/* Advanced Toggle */}
            {config?.provider === "anthropic" && (
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                {showAdvanced ? "▼ Hide" : "▶ Advanced"} Options
              </button>
            )}
          </div>

          {/* Advanced Anthropic Options */}
          {showAdvanced && config?.provider === "anthropic" && config.model && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
              <h4 className="font-medium mb-3">⚙️ Advanced Options ({config.model.split("-")[1]})</h4>
              
              <div className="space-y-4">
                {/* Fast Mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Fast Mode</div>
                    <div className="text-xs text-gray-500">service_tier: auto (priority when available)</div>
                  </div>
                  <button
                    onClick={() => saveModelParams(config.model, {
                      ...config.modelParams?.[config.model],
                      fastMode: !config.modelParams?.[config.model]?.fastMode
                    })}
                    className={`px-3 py-1 rounded text-sm ${
                      config.modelParams?.[config.model]?.fastMode
                        ? "bg-green-500 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    {config.modelParams?.[config.model]?.fastMode ? "ON" : "OFF"}
                  </button>
                </div>

                {/* Prompt Caching */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Prompt Caching</div>
                    <div className="text-xs text-gray-500">Reduce costs for repeated context</div>
                  </div>
                  <select
                    value={config.modelParams?.[config.model]?.cacheRetention || "short"}
                    onChange={(e) => saveModelParams(config.model, {
                      ...config.modelParams?.[config.model],
                      cacheRetention: e.target.value
                    })}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    <option value="none">None</option>
                    <option value="short">Short (5 min)</option>
                    <option value="long">Long (1 hour)</option>
                  </select>
                </div>

                {/* 1M Context */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">1M Context Window</div>
                    <div className="text-xs text-gray-500">Beta: Extended context (Opus/Sonnet)</div>
                  </div>
                  <button
                    onClick={() => saveModelParams(config.model, {
                      ...config.modelParams?.[config.model],
                      context1m: !config.modelParams?.[config.model]?.context1m
                    })}
                    className={`px-3 py-1 rounded text-sm ${
                      config.modelParams?.[config.model]?.context1m
                        ? "bg-green-500 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    {config.modelParams?.[config.model]?.context1m ? "ON" : "OFF"}
                  </button>
                </div>

                {/* Thinking Mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Thinking Mode</div>
                    <div className="text-xs text-gray-500">Extended reasoning for complex tasks</div>
                  </div>
                  <select
                    value={config.modelParams?.[config.model]?.thinking || "adaptive"}
                    onChange={(e) => saveModelParams(config.model, {
                      ...config.modelParams?.[config.model],
                      thinking: e.target.value
                    })}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    <option value="off">Off</option>
                    <option value="adaptive">Adaptive (default)</option>
                    <option value="on">Always On</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Test Model */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-3">🧪 Test Current Model</h2>
          <p className="text-sm text-gray-500 mb-4">Send a test message to verify the model is working. Changes take effect <strong>instantly</strong> — no restart needed.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setSaving(true); setError("");
                try {
                  const res = await fetch("/api/v1/model", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "test" }),
                  });
                  const data = await res.json();
                  if (data.data?.success) {
                    showSuccess();
                    setError(`✅ "${data.data.response}" (${data.data.latencyMs}ms)`);
                  } else {
                    setError(`❌ ${data.data?.error || "Test failed"}`);
                  }
                } catch (e: any) { setError(`❌ ${e.message}`); }
                setSaving(false);
              }}
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Testing..." : "🧪 Test Model"}
            </button>
            <span className="text-xs text-gray-400">
              Current: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{config?.provider}/{config?.model}</code>
            </span>
          </div>
          {error && error.startsWith("✅") && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{error}</div>
          )}
        </section>

        {/* Tips */}
        <section className="bg-gray-100 rounded-xl p-4 text-sm text-gray-600">
          <h3 className="font-semibold mb-2">💡 Quick Tips</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li><strong>Instant switch</strong> — Model changes apply to the next message, no restart needed</li>
            <li><strong>Claude Sonnet 4</strong> — Best for coding, fast & capable</li>
            <li><strong>OpenRouter</strong> — Access all providers with one API key</li>
            <li><strong>Ollama Cloud</strong> — Use qwen3-coder:480b or gpt-oss:120b</li>
          </ul>
        </section>
        </>}

        {/* ========== AUTH TAB ========== */}
        {activeTab === "auth" && (
          <div className="space-y-6">
            {/* Header */}
            <section className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-xl border border-purple-200 p-6">
              <h2 className="text-lg font-semibold mb-2">🔐 Authentication</h2>
              <p className="text-sm text-gray-600">
                Connect your AI provider accounts. Login with OAuth or paste API keys.
              </p>
            </section>

            {/* Providers */}
            <section className="bg-white rounded-xl border p-6">
              <h3 className="text-md font-semibold mb-4">AI Providers</h3>
              
              <div className="space-y-4">
                {authProviders.map((provider) => (
                  <div key={provider.id} 
                    className={`p-4 rounded-xl border-2 transition-all ${
                      provider.configured 
                        ? "border-green-200 bg-green-50/50" 
                        : "border-gray-200 hover:border-purple-200"
                    }`}>
                    <div className="flex items-center justify-between">
                      {/* Provider Info */}
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${provider.color} flex items-center justify-center text-white text-lg shadow-sm`}>
                          {provider.icon}
                        </div>
                        <div>
                          <div className="font-medium">{provider.name}</div>
                          <div className="text-xs text-gray-500">
                            {provider.configured ? (
                              <span className="text-green-600 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                Connected via {provider.source}
                              </span>
                            ) : (
                              "Not configured"
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {provider.configured ? (
                          <>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                              ✓ Active
                            </span>
                            <button
                              onClick={() => {
                                if (provider.activeProfile) {
                                  removeProfile(provider.activeProfile);
                                }
                              }}
                              className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                            >
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <>
                            {provider.authMethod === "oauth" && (
                              <button
                                onClick={() => startOAuth(provider.id)}
                                disabled={oauthLoading === provider.id}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                              >
                                {oauthLoading === provider.id ? (
                                  <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    Connecting...
                                  </>
                                ) : (
                                  <>🔗 Login with {provider.name.split(" ")[0]}</>
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setShowAuthModal(provider.id);
                                setApiKeyInput("");
                              }}
                              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all"
                            >
                              🔑 Add API Key
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Instructions (collapsed) */}
                    {!provider.configured && provider.instructions && (
                      <details className="mt-3">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          📖 How to get credentials
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 whitespace-pre-wrap">
                          {provider.instructions}
                        </pre>
                        {provider.consoleUrl && (
                          <a 
                            href={provider.consoleUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
                          >
                            🔗 Open {provider.name.split(" ")[0]} Console →
                          </a>
                        )}
                      </details>
                    )}
                  </div>
                ))}

                {authProviders.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <span className="text-4xl">🔑</span>
                    <p className="mt-2">Loading providers...</p>
                  </div>
                )}
              </div>
            </section>

            {/* Connected Profiles */}
            {authProfiles.length > 0 && (
              <section className="bg-white rounded-xl border p-6">
                <h3 className="text-md font-semibold mb-4">Connected Accounts</h3>
                <div className="space-y-2">
                  {authProfiles.map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {profile.type === "oauth" ? "🔗" : "🔑"}
                        </span>
                        <div>
                          <div className="text-sm font-medium">{profile.id}</div>
                          <div className="text-xs text-gray-500">
                            {profile.email || profile.provider} • {profile.type}
                            {profile.expiresAt && (
                              <span className="ml-2">
                                Expires: {new Date(profile.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeProfile(profile.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Tips */}
            <section className="bg-blue-50 rounded-xl border border-blue-100 p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">💡 Tips</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• <strong>OAuth</strong> — Best option, uses your existing account (Google)</li>
                <li>• <strong>API Key</strong> — Works for all providers, paste from console</li>
                <li>• <strong>Environment vars</strong> — Set ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.</li>
                <li>• Profiles are stored locally in <code className="bg-blue-100 px-1 rounded">auth-profiles.json</code></li>
              </ul>
            </section>
          </div>
        )}

        {/* ========== SECURITY TAB ========== */}
        {activeTab === "security" && (
          <div className="space-y-6">
            <section className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">🔒 Security Settings</h2>
              {securityConfig ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">Security Engine</div>
                      <div className="text-xs text-gray-500">Command guard, path guard, rate limits</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${securityConfig.enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {securityConfig.enabled ? "● Enabled" : "○ Disabled"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{securityConfig.blockedCommands?.length || 0}</div>
                      <div className="text-xs text-gray-500">Blocked Command Patterns</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{securityConfig.blockedPaths?.length || 0}</div>
                      <div className="text-xs text-gray-500">Blocked Paths</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{Object.keys(securityConfig.rateLimits || {}).length}</div>
                      <div className="text-xs text-gray-500">Rate-Limited Tools</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{securityConfig.blockedTools?.length || 0}</div>
                      <div className="text-xs text-gray-500">Blocked Tools</div>
                    </div>
                  </div>

                  {securityConfig.blockedPaths?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Blocked Paths</h3>
                      <div className="space-y-1">
                        {securityConfig.blockedPaths.map((p: string, i: number) => (
                          <div key={i} className="text-xs font-mono text-gray-600 bg-gray-50 px-3 py-1.5 rounded">{p}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(securityConfig.rateLimits || {}).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Rate Limits (per minute)</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(securityConfig.rateLimits).map(([tool, limit]: [string, any]) => (
                          <div key={tool} className="flex justify-between text-xs bg-gray-50 px-3 py-1.5 rounded">
                            <span className="font-mono text-gray-600">{tool}</span>
                            <span className="font-bold text-purple-600">{limit}/min</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">Loading security config...</div>
              )}
            </section>

            <section className="bg-gray-100 rounded-xl p-4 text-sm text-gray-600">
              <p>Security config is stored in <code>workspace/security.json</code>. Edit directly or use the <code>/api/v1/security</code> API.</p>
            </section>
          </div>
        )}

        {/* ========== PLUGINS TAB ========== */}
        {activeTab === "plugins" && (
          <div className="space-y-6">
            <section className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">🔌 Installed Plugins</h2>
                <button onClick={() => fetch("/api/v1/plugins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reload" }) }).then(() => fetch("/api/v1/plugins").then(r => r.json()).then(d => setPlugins(d.data?.plugins || [])))}
                  className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors">
                  🔄 Reload
                </button>
              </div>

              {plugins.length > 0 ? (
                <div className="space-y-3">
                  {plugins.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.enabled ? "bg-green-500" : "bg-gray-300"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{p.manifest?.name || p.id}</div>
                        <div className="text-xs text-gray-500">{p.manifest?.description || "No description"}</div>
                        <div className="flex gap-2 mt-1">
                          {p.hasSkill && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">SKILL</span>}
                          {p.triggers?.length > 0 && <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">{p.triggers.length} triggers</span>}
                          <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{p.source}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => fetch("/api/v1/plugins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id: p.id, enabled: !p.enabled }) }).then(() => fetch("/api/v1/plugins").then(r => r.json()).then(d => setPlugins(d.data?.plugins || [])))}
                        className={`px-3 py-1 text-xs rounded-lg transition-colors ${p.enabled ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-green-100 text-green-600 hover:bg-green-200"}`}>
                        {p.enabled ? "Disable" : "Enable"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-sm text-center py-6">
                  No plugins installed. Create one with the agent: <code>&quot;Create a weather plugin&quot;</code>
                </div>
              )}
            </section>

            <section className="bg-gray-100 rounded-xl p-4 text-sm text-gray-600">
              <p>Plugins live in <code>workspace/plugins/</code>. Each plugin has <code>plugin.json</code> + <code>SKILL.md</code>.</p>
            </section>
          </div>
        )}

        {/* ========== MCP TAB ========== */}
        {activeTab === "mcp" && (
          <div className="space-y-6">
            <section className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">🔗 MCP Servers</h2>
                  <p className="text-xs text-gray-500 mt-1">Connect external MCP servers to give Karya more tools</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Port: 3001</span>
                  <button onClick={() => { setMcpServers([]); fetch("/api/v1/mcp/servers").then(r => r.json()).then(d => setMcpServers(d.data?.servers || d.servers || [])); }}
                    className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors">🔄 Refresh</button>
                </div>
              </div>

              {/* Add new server */}
              <div className="flex gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                <input value={mcpNewName} onChange={(e) => setMcpNewName(e.target.value)} placeholder="Server name" className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:border-purple-400 focus:outline-none" />
                <input value={mcpNewUrl} onChange={(e) => setMcpNewUrl(e.target.value)} placeholder="http://localhost:8080/mcp" className="flex-[2] px-3 py-1.5 text-sm border rounded-lg focus:border-purple-400 focus:outline-none font-mono" />
                <button onClick={async () => {
                  if (!mcpNewName || !mcpNewUrl) return;
                  await fetch("/api/v1/mcp/servers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: mcpNewName, url: mcpNewUrl }) });
                  setMcpNewName(""); setMcpNewUrl("");
                  const r = await fetch("/api/v1/mcp/servers"); const d = await r.json(); setMcpServers(d.data?.servers || d.servers || []);
                }} className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">+ Add</button>
              </div>

              {/* Server list */}
              {mcpServers.length > 0 ? (
                <div className="space-y-2">
                  {mcpServers.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.enabled ? "bg-green-500" : "bg-gray-300"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{s.name || s.id}</div>
                        <div className="text-xs text-gray-500 font-mono truncate">{s.url}</div>
                        {s.transport && <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded mt-1 inline-block">{s.transport}</span>}
                      </div>
                      <button onClick={async () => {
                        await fetch(`/api/v1/mcp/servers/${encodeURIComponent(s.name || s.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !s.enabled }) });
                        const r = await fetch("/api/v1/mcp/servers"); const d = await r.json(); setMcpServers(d.data?.servers || d.servers || []);
                      }} className={`px-3 py-1 text-xs rounded-lg transition-colors ${s.enabled ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-green-100 text-green-600 hover:bg-green-200"}`}>
                        {s.enabled ? "Disable" : "Enable"}
                      </button>
                      <button onClick={async () => {
                        await fetch(`/api/v1/mcp/servers/${encodeURIComponent(s.name || s.id)}`, { method: "DELETE" });
                        const r = await fetch("/api/v1/mcp/servers"); const d = await r.json(); setMcpServers(d.data?.servers || d.servers || []);
                      }} className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">🗑️</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-sm text-center py-6">No MCP servers connected. Add one above to extend Karya&apos;s capabilities.</div>
              )}
            </section>

            <section className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-3">📡 Karya MCP Server</h3>
              <p className="text-sm text-gray-600 mb-3">Karya exposes its own tools via MCP on port <code className="bg-gray-100 px-1.5 py-0.5 rounded">3001</code>. External clients (Cursor, Claude Desktop, VS Code) can connect to use Karya&apos;s tools.</p>
              <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600">
                <div>URL: http://localhost:3001</div>
                <div>Transport: streamable-http</div>
                <div>Tools: 77+</div>
              </div>
            </section>

            <section className="bg-gray-100 rounded-xl p-4 text-sm text-gray-600">
              <p>MCP servers are stored in <code>karya-mcp.json</code>. Connected tools are auto-injected into the agent.</p>
            </section>
          </div>
        )}

        {/* ========== ABOUT TAB ========== */}
        {activeTab === "about" && (
          <div className="space-y-6">
            <section className="bg-white rounded-xl border p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-3xl mx-auto mb-4 shadow-xl shadow-purple-500/20">⚡</div>
              <h2 className="text-2xl font-bold mb-1">Karya</h2>
              <p className="text-gray-500 mb-4">AI Computer Agent that DOES real things.</p>
              <div className="flex justify-center gap-6 text-sm text-gray-600 mb-6">
                <div><span className="font-bold text-purple-600">82</span> tools</div>
                <div><span className="font-bold text-purple-600">6</span> agents</div>
                <div><span className="font-bold text-purple-600">9</span> workflows</div>
                <div><span className="font-bold text-purple-600">29</span> API routes</div>
              </div>
              <div className="space-y-2 text-sm text-left max-w-md mx-auto">
                <div className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-500">Version</span><span className="font-mono">0.5.0</span></div>
                <div className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-500">Stack</span><span>Mastra + Next.js + TypeScript</span></div>
                <div className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-500">Author</span><span>Ravi Kulhari</span></div>
                <div className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-500">GitHub</span><a href="https://github.com/kulharir7/karya" target="_blank" className="text-purple-600 hover:underline">kulharir7/karya</a></div>
                <div className="flex justify-between py-1"><span className="text-gray-500">License</span><span>MIT</span></div>
              </div>
            </section>

            <section className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-3">🏗️ Architecture</h3>
              <pre className="text-xs text-gray-600 font-mono bg-gray-50 p-4 rounded-lg overflow-x-auto whitespace-pre">{`Web UI → SSE → ChatProcessor ← CLI (REPL)
                    ↑                ↑
               WebSocket        Telegram
                    ↓
          agent.stream() → Mastra Supervisor
               ├── 82 tools (security-checked)
               ├── 6 specialist agents
               ├── 9 workflows
               └── Plugin skills injected`}</pre>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
