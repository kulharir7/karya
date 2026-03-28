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

export default function Header({
  sessions, activeId, currentSession, messageCount, isLoading, streamingTools,
  streamingText, activeAgent, onToggleSidebar, onSwitchSession, onNewSession,
  onClearChat, onDeleteSession, onCancelRequest, onRenameSession, onExportChat,
}: HeaderProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
        {/* Model badge */}
        <span className="hidden lg:flex text-[9px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-1 rounded-md border border-[var(--border)] font-mono mr-1">
          gpt-oss:120b
        </span>

        {/* Session switcher */}
        <select value={activeId} onChange={(e) => onSwitchSession(e.target.value)}
          className="text-[11px] bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-secondary)] focus:outline-none focus:border-purple-400 max-w-[120px] truncate">
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {/* Export */}
        <button onClick={onExportChat} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors" title="Export chat">
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
