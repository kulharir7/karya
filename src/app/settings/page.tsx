"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Settings {
  model: string;
  baseUrl: string;
  theme: string;
}

const MODELS = [
  { id: "gpt-oss:120b", name: "GPT-OSS 120B", speed: "Fast" },
  { id: "qwen3-coder:480b", name: "Qwen3 Coder 480B", speed: "Medium" },
  { id: "deepseek-r1:671b", name: "DeepSeek R1 671B", speed: "Slow" },
  { id: "glm-5:cloud", name: "GLM-5 Cloud", speed: "Medium" },
  { id: "qwen3:235b", name: "Qwen3 235B", speed: "Medium" },
  { id: "gemma3:27b", name: "Gemma 3 27B", speed: "Fast" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    model: "gpt-oss:120b",
    baseUrl: "https://ollama.com/v1",
    theme: "dark",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("karya-settings");
      if (raw) setSettings(JSON.parse(raw));
    } catch {}
  }, []);

  const save = () => {
    localStorage.setItem("karya-settings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              ← Back
            </Link>
            <h1 className="text-lg font-bold">Settings</h1>
          </div>
          <button
            onClick={save}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              saved
                ? "bg-green-600 text-white"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            }`}
          >
            {saved ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Model Selection */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
            🤖 AI Model
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => setSettings({ ...settings, model: model.id })}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                  settings.model === model.id
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-purple-500/30"
                }`}
              >
                <div>
                  <p className="font-medium text-sm">{model.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{model.id}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    model.speed === "Fast"
                      ? "bg-green-500/20 text-green-400"
                      : model.speed === "Medium"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {model.speed}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* API Configuration */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
            🔑 API Configuration
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">
                Base URL
              </label>
              <input
                type="text"
                value={settings.baseUrl}
                onChange={(e) =>
                  setSettings({ ...settings, baseUrl: e.target.value })
                }
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
            ⚡ About Karya
          </h2>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 space-y-2">
            <p className="text-sm">
              <span className="text-[var(--text-secondary)]">Version:</span> 0.1.0
            </p>
            <p className="text-sm">
              <span className="text-[var(--text-secondary)]">Stack:</span> Mastra + Stagehand + Next.js
            </p>
            <p className="text-sm">
              <span className="text-[var(--text-secondary)]">Tools:</span> 15 (Browser, File, Shell, System)
            </p>
            <p className="text-sm">
              <span className="text-[var(--text-secondary)]">Author:</span> Ravi Kulhari
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
