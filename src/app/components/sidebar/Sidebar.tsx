"use client";

import { useState } from "react";
import Link from "next/link";
import { icons } from "./SidebarIcons";

// ---- Sub-components ----

function SidebarSection({ title, children, defaultOpen = true, action }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3 first:mt-2">
      <div className="flex items-center justify-between px-4 py-1.5">
        <div onClick={() => setOpen(!open)} className="flex items-center gap-1 cursor-pointer flex-1 select-none">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={`transition-transform duration-200 text-[var(--text-muted)] ${open ? "rotate-90" : ""}`}>
            <path d="M9 6l6 6-6 6"/>
          </svg>
          <span className="sidebar-section-title !p-0">{title}</span>
        </div>
        {action && <div className="flex items-center">{action}</div>}
      </div>
      {open && <div className="space-y-0.5 mt-1">{children}</div>}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, onDelete, badge }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; onDelete?: () => void; badge?: string;
}) {
  return (
    <div onClick={onClick} className={`sidebar-item ${active ? "active" : ""}`}>
      <span className="shrink-0 text-[var(--sidebar-text-muted)]">{icon}</span>
      <span className="flex-1 text-[13px] truncate">{label}</span>
      {badge && (
        <kbd className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded font-mono border border-[var(--border)]">{badge}</kbd>
      )}
      {onDelete && (
        <span onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--error)] text-xs transition-opacity">✕</span>
      )}
    </div>
  );
}

function NavLink({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link href={href} className="sidebar-item">
      <span className="shrink-0 text-[var(--sidebar-text-muted)]">{icon}</span>
      <span className="flex-1 text-[13px] truncate">{label}</span>
    </Link>
  );
}

// ---- Main Sidebar ----

interface Session { id: string; name: string; }

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
  return (
    <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:static z-40 w-[240px] sidebar flex flex-col shrink-0 h-full transition-transform duration-200`}>
      {/* Logo */}
      <div className="px-4 py-3.5 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-purple-500/20">⚡</div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-[var(--text-primary)] tracking-tight">Karya</div>
            <div className="text-[9px] text-[var(--text-muted)] font-medium">AI Computer Agent</div>
          </div>
          <button onClick={onToggleDark} className="w-8 h-8 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--accent-light)] flex items-center justify-center transition-all" title={dark ? "Light mode" : "Dark mode"}>
            <span className="text-base">{dark ? "☀️" : "🌙"}</span>
          </button>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        <SidebarSection title="CONTROL">
          <NavLink icon={icons.dashboard} label="Dashboard" href="/dashboard" />
          <NavItem icon={icons.search} label="Command" onClick={onOpenCommand} badge="⌘K" />
          <NavLink icon={icons.tools} label="Tools & Help" href="/help" />
          <NavLink icon={icons.settings} label="Settings" href="/settings" />
        </SidebarSection>

        <SidebarSection title="PAGES">
          <NavLink icon={icons.automation} label="Workflows" href="/workflows" />
          <NavLink icon={icons.sessions} label="Tasks" href="/tasks" />
          <NavLink icon={icons.memory} label="Memory" href="/memory" />
          <NavLink icon={icons.logs} label="Audit Log" href="/audit" />
        </SidebarSection>

        <SidebarSection title="CHATS" action={
          <button onClick={onNewSession} className="text-[var(--sidebar-text-muted)] hover:text-[var(--text-primary)] transition-colors">{icons.plus}</button>
        }>
          {sessions.slice(0, 10).map((s) => (
            <NavItem key={s.id} icon={icons.chat} label={s.name} active={s.id === activeId}
              onClick={() => onSwitchSession(s.id)}
              onDelete={s.id !== "default" ? () => onDeleteSession(s.id) : undefined} />
          ))}
          {sessions.length === 0 && (
            <div className="px-4 py-2 text-[11px] text-[var(--sidebar-text-muted)]">No chats yet</div>
          )}
        </SidebarSection>

        <SidebarSection title="DEBUG" defaultOpen={false}>
          <NavItem icon={icons.export} label="Export Chat" onClick={onExportChat} />
        </SidebarSection>
      </div>

      {/* Bottom status */}
      <div className="px-3 py-3 border-t border-[var(--sidebar-border)]">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <span className="text-xs text-white font-bold">K</span>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[var(--sidebar-bg)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-[var(--text-primary)] truncate">Karya v0.5</div>
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
              <span className="truncate">82 tools</span>
              <span>•</span>
              <span>{taskCount} tasks</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
