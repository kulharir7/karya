"use client";

import { useState, useRef, useEffect } from "react";
import type { AgentInfo, ToolCall } from "@/app/hooks/useChat";
import { icons } from "@/app/components/sidebar/SidebarIcons";

interface Session { id: string; name: string; messageCount?: number; }

interface HeaderProps {
  sessions: Session[];
  activeId: string;
  currentSession?: Session;
  messageCount: number;
  isLoading: boolean;
  streamingTools: ToolCall[];
  streamingText: string;
  activeAgent: AgentInfo | null;
  onToggleSidebar: () => void;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  onClearChat: () => void;
  onDeleteSession: () => void;
  onCancelRequest: () => void;
  onRenameSession: (name: string) => void;
  onExportChat: () => void;
}

const AGENT_LABELS: Record<string, string> = {
  browser: "🌐 Browser", file: "📁 File", coder: "💻 Coder",
  researcher: "🔍 Research", "data-analyst": "📊 Data",
};

// All available models grouped by provider
const MODEL_OPTIONS = [
  { provider: "anthropic", label: "Anthropic", models: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", icon: "⚡" },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4", icon: "🧠" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", icon: "⚡" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", icon: "⚡⚡" },
  ]},
  { provider: "openai", label: "OpenAI", models: [
    { id: "gpt-4o", name: "GPT-4o", icon: "🧠" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", icon: "⚡" },
    { id: "o1", name: "o1", icon: "🧠" },
    { id: "o3-mini", name: "o3 Mini", icon: "⚡" },
  ]},
  { provider: "google", label: "Google", models: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", icon: "🧠" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", icon: "⚡" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", icon: "⚡⚡" },
  ]},
  { provider: "ollama-cloud", label: "Ollama Cloud", models: [
    { id: "qwen3-coder:480b", name: "Qwen 3 Coder 480B", icon: "💻" },
    { id: "gpt-oss:120b", name: "GPT-OSS 120B", icon: "🧠" },
    { id: "kimi-k2.5:cloud", name: "Kimi K2.5", icon: "⚡" },
    { id: "deepseek-r1:cloud", name: "DeepSeek R1", icon: "🧠" },
  ]},
  { provider: "ollama", label: "Ollama Local", models: [
    { id: "llama3.3:70b", name: "Llama 3.3 70B", icon: "🦙" },
    { id: "qwen2.5-coder:32b", name: "Qwen 2.5 Coder 32B", icon: "💻" },
    { id: "deepseek-coder-v2:16b", name: "DeepSeek Coder V2", icon: "💻" },
  ]},
];

export default function Header({
  sessions, activeId, currentSession, messageCount, isLoading, streamingTools,
  streamingText, activeAgent, onToggleSidebar, onSwitchSession, onNewSession,
  onClearChat, onDeleteSession, onCancelRequest, onRenameSession, onExportChat,
}: HeaderProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [currentModel, setCurrentModel] = useState("loading...");
  const [currentProvider, setCurrentProvider] = useState("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch current model on mount
  useEffect(() => {
    fetch("/api/v1/model").then(r => r.json()).then(d => {
      if (d.data?.displayName) setCurrentModel(d.data.displayName);
      if (d.data?.provider) setCurrentProvider(d.data.provider);
    }).catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    if (modelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [modelDropdownOpen]);

  // Focus input when editing starts
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startRename = () => {
    setEditName(currentSession?.name || "");
    setEditing(true);
  };

  const finishRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== currentSession?.name) {
      onRenameSession(trimmed);
    }
    setEditing(false);
  };

  // Switch model via API
  const switchModel = async (provider: string, model: string) => {
    setSwitching(true);
    setModelDropdownOpen(false);
    try {
      const res = await fetch("/api/v1/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        // Update display immediately
        setCurrentProvider(provider);
        setCurrentModel(data.data.displayName || `${provider}/${model}`);
      }
    } catch (err) {
      console.error("Failed to switch model:", err);
    } finally {
      setSwitching(false);
    }
  };

  // Get short display name
  const getShortModelName = () => {
    const parts = currentModel.split("/");
    const modelPart = parts[parts.length - 1];
    // Shorten long names
    if (modelPart.length > 20) {
      return modelPart.substring(0, 18) + "...";
    }
    return modelPart;
  };

  return (
    <div className="h-12 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center px-4 shrink-0">
      {/* Mobile hamburger */}
      <button onClick={onToggleSidebar} className="md:hidden mr-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">☰</button>

      {/* Left: Session name (editable) + agent badge */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs text-[var(--text-muted)] shrink-0">⚡</span>

        {editing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={finishRename}
            onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setEditing(false); }}
            className="text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-primary)] border border-[var(--accent)] rounded px-2 py-0.5 focus:outline-none w-[200px]"
            maxLength={50}
          />
        ) : (
          <button onClick={startRename} className="text-sm font-medium text-[var(--text-primary)] truncate hover:text-purple-500 transition-colors max-w-[200px]" title="Click to rename">
            {currentSession?.name || "Chat"}
          </button>
        )}

        {/* Agent badge */}
        {activeAgent && activeAgent.agent !== "supervisor" && (
          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-medium border border-purple-500/20 shrink-0">
            {AGENT_LABELS[activeAgent.agent] || activeAgent.agent}
          </span>
        )}

        {/* Message count */}
        <span className="text-[10px] text-[var(--text-muted)] shrink-0">
          {messageCount > 0 && `${messageCount} msgs`}
        </span>
      </div>

      {/* Center: Loading state */}
      {isLoading && (
        <div className="flex items-center gap-2 mx-4 shrink-0">
          <div className="w-3 h-3 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          <span className="text-xs text-purple-500 font-medium max-w-[150px] truncate">
            {streamingTools.length > 0
              ? `${streamingTools[streamingTools.length - 1]?.toolName}`
              : streamingText ? "Generating..." : "Thinking..."}
          </span>
          <button onClick={onCancelRequest}
            className="px-2 py-0.5 rounded text-[10px] text-red-400 hover:bg-red-500/10 transition-all font-medium">■</button>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Model Switcher Dropdown */}
        <div className="relative hidden lg:block" ref={dropdownRef}>
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border transition-all font-mono ${
              modelDropdownOpen 
                ? "bg-purple-500/10 border-purple-500/50 text-purple-400" 
                : "bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text-muted)] hover:border-purple-500/30 hover:text-[var(--text-secondary)]"
            }`}
            title="Click to change model"
          >
            {switching ? (
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full border border-purple-400 border-t-transparent animate-spin" />
                Switching...
              </span>
            ) : (
              <>
                <span className="text-[11px]">🤖</span>
                <span>{getShortModelName()}</span>
                <span className="text-[8px] opacity-60">▼</span>
              </>
            )}
          </button>

          {/* Dropdown Menu */}
          {modelDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="p-2 border-b border-[var(--border)]">
                <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">Switch Model</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {MODEL_OPTIONS.map((group) => (
                  <div key={group.provider}>
                    <div className="px-3 py-1.5 text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-primary)]">
                      {group.label}
                    </div>
                    {group.models.map((model) => {
                      const isActive = currentProvider === group.provider && currentModel.includes(model.id);
                      return (
                        <button
                          key={model.id}
                          onClick={() => switchModel(group.provider, model.id)}
                          className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${
                            isActive 
                              ? "bg-purple-500/10 text-purple-400" 
                              : "hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                          }`}
                        >
                          <span className="text-sm">{model.icon}</span>
                          <span className="text-[11px] font-medium flex-1">{model.name}</span>
                          {isActive && <span className="text-[10px] text-purple-400">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-[var(--border)] bg-[var(--bg-primary)]">
                <a href="/settings" className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  ⚙️ More options in Settings
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Session switcher */}
        <select value={activeId} onChange={(e) => onSwitchSession(e.target.value)}
          className="text-[11px] bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-secondary)] focus:outline-none focus:border-purple-400 max-w-[120px] sm:max-w-[140px] truncate">
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {/* Export — hidden on small mobile */}
        <button onClick={onExportChat} className="hidden sm:block header-export-btn p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors" title="Export chat">
          {icons.export}
        </button>

        {/* Clear */}
        <button onClick={onClearChat} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-hover)] transition-colors" title="Clear messages">
          {icons.trash}
        </button>

        {/* Delete */}
        {activeId !== "default" && (
          <button onClick={onDeleteSession} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-hover)] transition-colors" title="Delete chat">
            {icons.close}
          </button>
        )}

        {/* New chat */}
        <button onClick={onNewSession}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-sm ml-1">
          {icons.plus} New
        </button>
      </div>
    </div>
  );
}
