"use client";

import type { AgentInfo, ToolCall } from "@/app/hooks/useChat";
import { icons } from "@/app/components/sidebar/SidebarIcons";

interface Session { id: string; name: string; }

interface HeaderProps {
  sessions: Session[];
  activeId: string;
  currentSession?: Session;
  isLoading: boolean;
  streamingTools: ToolCall[];
  streamingText: string;
  activeAgent: AgentInfo | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  onClearChat: () => void;
  onDeleteSession: () => void;
  onCancelRequest: () => void;
}

const AGENT_LABELS: Record<string, string> = {
  browser: "🌐 Browser", file: "📁 File", coder: "💻 Coder",
  researcher: "🔍 Research", "data-analyst": "📊 Data",
};

export default function Header({
  sessions, activeId, currentSession, isLoading, streamingTools, streamingText,
  activeAgent, sidebarOpen, onToggleSidebar, onSwitchSession, onNewSession,
  onClearChat, onDeleteSession, onCancelRequest,
}: HeaderProps) {
  return (
    <div className="h-11 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center px-4 shrink-0">
      <button onClick={onToggleSidebar} className="md:hidden mr-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">☰</button>

      <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
        <span className="text-[var(--text-muted)]">Karya ›</span>
        <span className="font-medium text-[var(--text-primary)] truncate">{currentSession?.name || "Chat"}</span>
        {activeAgent && activeAgent.agent !== "supervisor" && (
          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-medium border border-purple-500/20">
            {AGENT_LABELS[activeAgent.agent] || activeAgent.agent}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isLoading && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            <span className="text-xs text-purple-600 font-medium">
              {streamingTools.length > 0 ? `Using ${streamingTools[streamingTools.length - 1]?.toolName}...` : streamingText ? "Generating..." : "Thinking..."}
            </span>
            <button onClick={onCancelRequest}
              className="px-2 py-0.5 rounded text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all font-medium">■ Stop</button>
          </div>
        )}

        <select value={activeId} onChange={(e) => onSwitchSession(e.target.value)}
          className="text-xs bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-secondary)] focus:outline-none focus:border-purple-400 max-w-[140px] truncate">
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <button onClick={onClearChat} className="px-2 py-1 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-hover)] transition-colors" title="Clear messages">{icons.trash}</button>
        {activeId !== "default" && (
          <button onClick={onDeleteSession} className="px-2 py-1 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-hover)] transition-colors" title="Delete chat">{icons.close}</button>
        )}
        <button onClick={onNewSession}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-sm">
          {icons.plus} New
        </button>
      </div>
    </div>
  );
}
