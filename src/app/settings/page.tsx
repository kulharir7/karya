"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Settings {
  model: string;
  baseUrl: string;
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

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((s) => { setSettings(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50"><p className="text-gray-400">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">← Back</Link>
            <span className="text-gray-300">·</span>
            <h1 className="text-sm font-semibold text-gray-800">Settings</h1>
          </div>
          <button onClick={save} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${saved ? "bg-green-100 text-green-700" : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"}`}>
            {saved ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Model */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">AI Model</h2>
          <div className="space-y-2">
            {MODELS.map((m) => (
              <button key={m.id} onClick={() => setSettings({ ...settings, model: m.id })}
                className={`w-full flex items-center justify-between p-3.5 rounded-lg border text-left transition-all ${
                  settings.model === m.id ? "border-purple-400 bg-purple-50 ring-1 ring-purple-200" : "border-gray-200 bg-white hover:border-gray-300"
                }`}>
                <div>
                  <p className="text-sm font-medium text-gray-800">{m.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
                </div>
                <span className="text-xs text-gray-500">{m.speed}</span>
              </button>
            ))}
          </div>
        </section>

        {/* API */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">API Configuration</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label className="text-xs text-gray-500 mb-1 block">Base URL</label>
            <input type="text" value={settings.baseUrl} onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100" />
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">About</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-1.5 text-sm text-gray-600">
            <p><span className="text-gray-400">Version</span> <span className="font-medium text-gray-800">0.1.0</span></p>
            <p><span className="text-gray-400">Stack</span> <span className="font-medium text-gray-800">Mastra + Stagehand + Next.js</span></p>
            <p><span className="text-gray-400">Tools</span> <span className="font-medium text-gray-800">22 tools (Browser, File, Shell, System)</span></p>
            <p><span className="text-gray-400">GitHub</span> <a href="https://github.com/kulharir7/karya" target="_blank" className="text-purple-600 hover:underline">kulharir7/karya</a></p>
          </div>
        </section>
      </div>
    </div>
  );
}
