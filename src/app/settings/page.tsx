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
  const [activeTab, setActiveTab] = useState<"model" | "security" | "plugins" | "about">("model");
  
  // Security state
  const [securityConfig, setSecurityConfig] = useState<any>(null);
  const [plugins, setPlugins] = useState<any[]>([]);
  
  // Load security + plugins on tab switch
  useEffect(() => {
    if (activeTab === "security" && !securityConfig) {
      fetch("/api/v1/security?action=config").then(r => r.json()).then(d => setSecurityConfig(d.data)).catch(() => {});
    }
    if (activeTab === "plugins" && plugins.length === 0) {
      fetch("/api/v1/plugins").then(r => r.json()).then(d => setPlugins(d.data?.plugins || [])).catch(() => {});
    }
  }, [activeTab, securityConfig, plugins.length]);

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
          {(["model", "security", "plugins", "about"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab ? "bg-white border border-b-white border-gray-200 -mb-px text-purple-600" : "text-gray-500 hover:text-gray-700"
              }`}>
              {{ model: "🤖 Model", security: "🔒 Security", plugins: "🔌 Plugins", about: "ℹ️ About" }[tab]}
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
