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

// Premium model definitions with rich metadata
const MODEL_GROUPS = [
  {
    id: "anthropic",
    name: "Anthropic",
    icon: "🤖",
    color: "from-orange-500 to-amber-600",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", badge: "Best", badgeColor: "bg-green-500", desc: "Fast & powerful", icon: "⚡" },
      { id: "claude-opus-4-20250514", name: "Claude Opus 4", badge: "Pro", badgeColor: "bg-purple-500", desc: "Most capable", icon: "🧠" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", desc: "Previous gen", icon: "✨" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", badge: "Fast", badgeColor: "bg-blue-500", desc: "Fastest responses", icon: "⚡" },
    ]
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "🧠",
    color: "from-emerald-500 to-teal-600",
    models: [
      { id: "gpt-4o", name: "GPT-4o", badge: "Popular", badgeColor: "bg-blue-500", desc: "Multimodal flagship", icon: "🌟" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", desc: "Fast & affordable", icon: "⚡" },
      { id: "o1", name: "o1", badge: "Reasoning", badgeColor: "bg-purple-500", desc: "Deep thinking", icon: "🧠" },
      { id: "o3-mini", name: "o3 Mini", badge: "New", badgeColor: "bg-pink-500", desc: "Latest reasoning", icon: "✨" },
    ]
  },
  {
    id: "google",
    name: "Google",
    icon: "✨",
    color: "from-blue-500 to-indigo-600",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", badge: "Best", badgeColor: "bg-green-500", desc: "Most capable", icon: "🧠" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Balanced speed", icon: "⚡" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", badge: "Fast", badgeColor: "bg-blue-500", desc: "Ultra fast", icon: "⚡⚡" },
    ]
  },
  {
    id: "ollama-cloud",
    name: "Ollama Cloud",
    icon: "☁️",
    color: "from-violet-500 to-purple-600",
    models: [
      { id: "qwen3-coder:480b", name: "Qwen 3 Coder", badge: "480B", badgeColor: "bg-orange-500", desc: "Best for coding", icon: "💻" },
      { id: "gpt-oss:120b", name: "GPT-OSS", badge: "120B", badgeColor: "bg-teal-500", desc: "Open source GPT", icon: "🧠" },
      { id: "kimi-k2.5:cloud", name: "Kimi K2.5", badge: "Fast", badgeColor: "bg-blue-500", desc: "Quick responses", icon: "⚡" },
      { id: "deepseek-r1:cloud", name: "DeepSeek R1", badge: "Reason", badgeColor: "bg-purple-500", desc: "Deep reasoning", icon: "🔬" },
    ]
  },
  {
    id: "ollama",
    name: "Local Models",
    icon: "🦙",
    color: "from-gray-500 to-slate-600",
    models: [
      { id: "llama3.3:70b", name: "Llama 3.3 70B", desc: "Meta's best open", icon: "🦙" },
      { id: "qwen2.5-coder:32b", name: "Qwen 2.5 Coder", desc: "Local coding", icon: "💻" },
      { id: "deepseek-coder-v2:16b", name: "DeepSeek Coder", desc: "Compact coder", icon: "🔧" },
    ]
  },
];

export default function Header({
  sessions, activeId, currentSession, messageCount, isLoading, streamingTools,
  streamingText, activeAgent, onToggleSidebar, onSwitchSession, onNewSession,
  onClearChat, onDeleteSession, onCancelRequest, onRenameSession, onExportChat,
}: HeaderProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [currentModel, setCurrentModel] = useState("");
  const [currentProvider, setCurrentProvider] = useState("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch current model on mount
  useEffect(() => {
    fetch("/api/v1/model").then(r => r.json()).then(d => {
      if (d.data?.model) setCurrentModel(d.data.model);
      if (d.data?.provider) setCurrentProvider(d.data.provider);
    }).catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
        setActiveGroup(null);
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

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModelDropdownOpen(false);
        setActiveGroup(null);
      }
    };
    if (modelDropdownOpen) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [modelDropdownOpen]);

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
    setActiveGroup(null);
    try {
      const res = await fetch("/api/v1/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setCurrentProvider(provider);
        setCurrentModel(model);
      }
    } catch (err) {
      console.error("Failed to switch model:", err);
    } finally {
      setSwitching(false);
    }
  };

  // Get current model display info
  const getCurrentModelInfo = () => {
    for (const group of MODEL_GROUPS) {
      const model = group.models.find(m => m.id === currentModel);
      if (model) {
        return { group, model };
      }
    }
    // Fallback
    return {
      group: MODEL_GROUPS[0],
      model: { id: currentModel, name: currentModel.split(":")[0] || "Model", icon: "🤖", desc: "" }
    };
  };

  const { group: currentGroup, model: currentModelInfo } = getCurrentModelInfo();

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
        
        {/* ═══════════════════════════════════════════════════════════════
            PREMIUM MODEL SWITCHER
        ═══════════════════════════════════════════════════════════════ */}
        <div className="relative hidden lg:block" ref={dropdownRef}>
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 ${
              modelDropdownOpen 
                ? "bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border-purple-500/50 shadow-lg shadow-purple-500/10" 
                : "bg-[var(--bg-tertiary)] border-[var(--border)] hover:border-purple-500/40 hover:bg-[var(--bg-hover)]"
            }`}
          >
            {switching ? (
              <span className="flex items-center gap-2 text-[11px] text-purple-400">
                <span className="w-3 h-3 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                Switching...
              </span>
            ) : (
              <>
                <span className="text-sm">{currentModelInfo.icon}</span>
                <div className="flex flex-col items-start">
                  <span className="text-[11px] font-semibold text-[var(--text-primary)] leading-tight">
                    {currentModelInfo.name}
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] leading-tight">
                    {currentGroup.name}
                  </span>
                </div>
                <svg className={`w-3 h-3 text-[var(--text-muted)] transition-transform duration-200 ${modelDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>

          {/* ═══════════════════════════════════════════════════════════════
              DROPDOWN MENU — Premium Design
          ═══════════════════════════════════════════════════════════════ */}
          {modelDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl shadow-black/20 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              
              {/* Header */}
              <div className="px-4 py-3 border-b border-[var(--border)] bg-gradient-to-r from-purple-500/5 to-indigo-500/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Choose Model</span>
                  <span className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full">
                    {MODEL_GROUPS.reduce((acc, g) => acc + g.models.length, 0)} models
                  </span>
                </div>
              </div>

              {/* Provider Groups */}
              <div className="max-h-96 overflow-y-auto">
                {MODEL_GROUPS.map((group) => (
                  <div key={group.id} className="border-b border-[var(--border)] last:border-b-0">
                    {/* Group Header */}
                    <button
                      onClick={() => setActiveGroup(activeGroup === group.id ? null : group.id)}
                      className={`w-full px-4 py-2.5 flex items-center justify-between transition-all ${
                        activeGroup === group.id 
                          ? "bg-gradient-to-r " + group.color + " bg-opacity-10" 
                          : "hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${group.color} flex items-center justify-center text-white text-sm shadow-sm`}>
                          {group.icon}
                        </span>
                        <div className="text-left">
                          <div className="text-[12px] font-semibold text-[var(--text-primary)]">{group.name}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">{group.models.length} models</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {currentProvider === group.id && (
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        )}
                        <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 ${activeGroup === group.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Models List */}
                    {activeGroup === group.id && (
                      <div className="bg-[var(--bg-primary)]/50 py-1">
                        {group.models.map((model) => {
                          const isActive = currentModel === model.id && currentProvider === group.id;
                          return (
                            <button
                              key={model.id}
                              onClick={() => switchModel(group.id, model.id)}
                              className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all ${
                                isActive 
                                  ? "bg-purple-500/10" 
                                  : "hover:bg-[var(--bg-hover)]"
                              }`}
                            >
                              {/* Icon */}
                              <span className="text-lg w-6 text-center">{model.icon}</span>
                              
                              {/* Info */}
                              <div className="flex-1 text-left">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[12px] font-medium ${isActive ? "text-purple-400" : "text-[var(--text-primary)]"}`}>
                                    {model.name}
                                  </span>
                                  {model.badge && (
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white ${model.badgeColor}`}>
                                      {model.badge}
                                    </span>
                                  )}
                                </div>
                                {model.desc && (
                                  <div className="text-[10px] text-[var(--text-muted)]">{model.desc}</div>
                                )}
                              </div>

                              {/* Check */}
                              {isActive && (
                                <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[var(--bg-primary)]/50">
                <a href="/settings" className="flex items-center gap-2 text-[11px] text-purple-400 hover:text-purple-300 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  API Keys & Advanced Settings
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
