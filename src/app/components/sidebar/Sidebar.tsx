"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { icons } from "./SidebarIcons";

// ============================================
// SUB-COMPONENTS
// ============================================

function Section({ title, children, defaultOpen = true, action }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-2 first:mt-1">
      <div className="flex items-center justify-between px-4 py-1.5">
        <div onClick={() => setOpen(!open)} className="flex items-center gap-1 cursor-pointer flex-1 select-none">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={`transition-transform duration-200 text-[var(--text-muted)] ${open ? "rotate-90" : ""}`}>
            <path d="M9 6l6 6-6 6"/>
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{title}</span>
        </div>
        {action}
      </div>
      {open && <div className="space-y-0.5 mt-0.5">{children}</div>}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, onDelete, badge, count }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void;
  onDelete?: () => void; badge?: string; count?: number;
}) {
  return (
    <div onClick={onClick} className={`group sidebar-item ${active ? "active" : ""}`}>
      <span className="shrink-0 text-[var(--sidebar-text-muted)]">{icon}</span>
      <span className="flex-1 text-[13px] truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{count}</span>
      )}
      {badge && (
        <kbd className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded font-mono border border-[var(--border)]">{badge}</kbd>
      )}
      {onDelete && (
        <span onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 text-xs transition-opacity cursor-pointer">✕</span>
      )}
    </div>
  );
}

function NavLink({ icon, label, href, badge }: { icon: React.ReactNode; label: string; href: string; badge?: string }) {
  return (
    <Link href={href} className="sidebar-item group">
      <span className="shrink-0 text-[var(--sidebar-text-muted)]">{icon}</span>
      <span className="flex-1 text-[13px] truncate">{label}</span>
      {badge && <span className="text-[9px] text-[var(--text-muted)]">{badge}</span>}
    </Link>
  );
}

// ============================================
// MAIN SIDEBAR
// ============================================

interface Session { id: string; name: string; messageCount?: number; updatedAt?: number; }

interface SidebarProps {
  sessions: Session[];
  activeId: string;
  dark: boolean;
  taskCount: number;
  sidebarOpen: boolean;
  onToggleDark: () => void;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenCommand: () => void;
  onExportChat: () => void;
}

export default function Sidebar({
  sessions, activeId, dark, taskCount, sidebarOpen,
  onToggleDark, onNewSession, onSwitchSession, onDeleteSession, onOpenCommand, onExportChat,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter sessions by search
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 15);
  }, [sessions, searchQuery]);

  return (
    <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:static z-40 w-[250px] sidebar flex flex-col shrink-0 h-full transition-transform duration-200`}>
      {/* ---- Logo ---- */}
      <div className="px-4 py-3 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-purple-500/20">⚡</div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-[var(--text-primary)] tracking-tight">Karya</div>
            <div className="text-[9px] text-[var(--text-muted)] font-medium">AI Computer Agent</div>
          </div>
          <button onClick={onToggleDark} className="w-7 h-7 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--accent-light)] flex items-center justify-center transition-all" title={dark ? "Light" : "Dark"}>
            <span className="text-sm">{dark ? "☀️" : "🌙"}</span>
          </button>
        </div>
      </div>

      {/* ---- Session Search ---- */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">{icons.search}</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-hover)] border border-transparent focus:border-[var(--accent)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs">✕</button>
          )}
        </div>
      </div>

      {/* ---- Navigation ---- */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        <Section title="SESSIONS" action={
          <button onClick={onNewSession} className="text-[var(--sidebar-text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5">{icons.plus}</button>
        }>
          {filteredSessions.map((s) => (
            <NavItem
              key={s.id}
              icon={icons.chat}
              label={s.name}
              active={s.id === activeId}
              count={s.messageCount}
              onClick={() => onSwitchSession(s.id)}
              onDelete={s.id !== "default" ? () => onDeleteSession(s.id) : undefined}
            />
          ))}
          {filteredSessions.length === 0 && (
            <div className="px-4 py-3 text-[11px] text-[var(--sidebar-text-muted)] text-center">
              {searchQuery ? "No matches" : "No chats yet"}
            </div>
          )}
        </Section>

        <Section title="NAVIGATION">
          <NavLink icon={icons.dashboard} label="Dashboard" href="/dashboard" />
          <NavItem icon={icons.search} label="Command Palette" onClick={onOpenCommand} badge="⌘K" />
          <NavLink icon={icons.tools} label="Tools & Help" href="/help" badge="82" />
          <NavLink icon={icons.automation} label="Workflows" href="/workflows" badge="9" />
          <NavLink icon={icons.sessions} label="Tasks" href="/tasks" />
          <NavLink icon={icons.memory} label="Memory" href="/memory" />
        </Section>

        <Section title="SYSTEM" defaultOpen={false}>
          <NavLink icon={icons.settings} label="Settings" href="/settings" />
          <NavLink icon={icons.logs} label="Audit Log" href="/audit" />
          <NavItem icon={icons.export} label="Export Chat" onClick={onExportChat} />
        </Section>
      </div>

      {/* ---- Bottom Status ---- */}
      <div className="px-3 py-2.5 border-t border-[var(--sidebar-border)]">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <span className="text-[10px] text-white font-bold">K</span>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border-[1.5px] border-[var(--sidebar-bg)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-[var(--text-primary)] truncate">v0.5 · 82 tools</div>
            <div className="text-[9px] text-[var(--text-muted)]">
              {sessions.length} sessions · {taskCount} tasks
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
