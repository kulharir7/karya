"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SystemData {
  os: string; platform: string; hostname: string; username: string;
  cpus: number; totalMemoryGB: number; freeMemoryGB: number;
  homeDir: string; cwd: string;
}

interface DiskInfo {
  drive: string; total: string; free: string; used: string; percent: number;
}

interface KaryaStats {
  sessions: number;
  messages: number;
  tools: number;
  workflows: number;
  tasks: number;
  triggers: number;
  plugins: number;
  memoryFiles: number;
}

interface AuditStats {
  totalEntries: number;
  byAction: Record<string, number>;
  byTool: Record<string, number>;
  successRate: number;
}

export default function Dashboard() {
  const [system, setSystem] = useState<SystemData | null>(null);
  const [disks, setDisks] = useState<DiskInfo[]>([]);
  const [processes, setProcesses] = useState<{ name: string; pid: number; memoryMB: number }[]>([]);
  const [stats, setStats] = useState<KaryaStats | null>(null);
  const [audit, setAudit] = useState<AuditStats | null>(null);
  const [recentTools, setRecentTools] = useState<Array<{ tool: string; timestamp: number; success: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/system").then((r) => r.json()).catch(() => null),
      fetch("/api/dashboard/disks").then((r) => r.json()).catch(() => ({ disks: [] })),
      fetch("/api/dashboard/processes").then((r) => r.json()).catch(() => ({ processes: [] })),
      fetch("/api/sessions").then((r) => r.json()).catch(() => ({ sessions: [] })),
      fetch("/api/workflows?action=stats").then((r) => r.json()).catch(() => null),
      fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] })),
      fetch("/api/triggers").then((r) => r.json()).catch(() => ({ triggers: [] })),
      fetch("/api/plugins").then((r) => r.json()).catch(() => ({ plugins: [] })),
      fetch("/api/audit?action=stats&days=7").then((r) => r.json()).catch(() => null),
      fetch("/api/audit?limit=10").then((r) => r.json()).catch(() => ({ entries: [] })),
      fetch("/api/memory?action=list").then((r) => r.json()).catch(() => ({ files: [] })),
    ]).then(([sys, dsk, proc, sessions, workflows, tasks, triggers, plugins, auditStats, auditRecent, memory]) => {
      setSystem(sys);
      setDisks(dsk.disks || []);
      setProcesses(proc.processes || []);
      
      // Calculate Karya stats
      setStats({
        sessions: sessions.sessions?.length || 0,
        messages: sessions.sessions?.reduce((sum: number, s: any) => sum + (s.messageCount || 0), 0) || 0,
        tools: 73, // We have 73 tools
        workflows: 9, // We have 9 workflows
        tasks: tasks.tasks?.length || 0,
        triggers: triggers.triggers?.length || 0,
        plugins: plugins.plugins?.length || 0,
        memoryFiles: memory.files?.length || 0,
      });
      
      setAudit(auditStats);
      
      // Recent tool calls
      if (auditRecent.entries) {
        setRecentTools(auditRecent.entries
          .filter((e: any) => e.action === "tool_call")
          .slice(0, 10)
          .map((e: any) => ({
            tool: e.tool,
            timestamp: e.timestamp,
            success: e.success,
          }))
        );
      }
      
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
    </div>
  );

  const memUsed = system ? system.totalMemoryGB - system.freeMemoryGB : 0;
  const memPercent = system ? Math.round((memUsed / system.totalMemoryGB) * 100) : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Back</Link>
          <span className="text-[var(--text-muted)]">·</span>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">📊 Dashboard</h1>
          <div className="flex-1" />
          <span className="text-xs text-[var(--text-muted)] font-mono">{time.toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        
        {/* Karya Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: "Sessions", value: stats?.sessions || 0, icon: "💬", color: "purple" },
            { label: "Messages", value: stats?.messages || 0, icon: "📨", color: "blue" },
            { label: "Tools", value: stats?.tools || 0, icon: "🔧", color: "amber" },
            { label: "Workflows", value: stats?.workflows || 0, icon: "⚡", color: "green" },
            { label: "Tasks", value: stats?.tasks || 0, icon: "⏰", color: "cyan" },
            { label: "Triggers", value: stats?.triggers || 0, icon: "🎯", color: "pink" },
            { label: "Plugins", value: stats?.plugins || 0, icon: "🔌", color: "indigo" },
            { label: "Memory", value: stats?.memoryFiles || 0, icon: "🧠", color: "orange" },
          ].map((c) => (
            <div key={c.label} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{c.icon}</span>
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">{c.label}</span>
              </div>
              <p className="text-xl font-bold text-[var(--text-primary)]">{c.value}</p>
            </div>
          ))}
        </div>

        {/* System + Audit Row */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* System Info */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">🖥️ System</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "OS", value: system?.os?.replace("Windows_NT ", "Win ") || "—" },
                { label: "CPU", value: `${system?.cpus || 0} cores` },
                { label: "Host", value: system?.hostname || "—" },
                { label: "User", value: system?.username || "—" },
              ].map((c) => (
                <div key={c.label}>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">{c.label}</div>
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">{c.value}</div>
                </div>
              ))}
            </div>
            
            {/* Memory Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[var(--text-muted)]">Memory</span>
                <span className="text-xs text-[var(--text-secondary)]">{memUsed.toFixed(1)} / {system?.totalMemoryGB || 0} GB ({memPercent}%)</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${memPercent > 80 ? "bg-red-500" : memPercent > 60 ? "bg-amber-500" : "bg-green-500"}`}
                  style={{ width: `${memPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Audit Stats */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">📈 Last 7 Days</h3>
            {audit ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">Total Calls</div>
                    <div className="text-lg font-bold text-[var(--text-primary)]">{audit.totalEntries}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">Success Rate</div>
                    <div className={`text-lg font-bold ${audit.successRate > 90 ? "text-green-500" : audit.successRate > 70 ? "text-amber-500" : "text-red-500"}`}>
                      {audit.successRate}%
                    </div>
                  </div>
                </div>
                
                {/* Top Tools */}
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Top Tools</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(audit.byTool || {}).slice(0, 5).map(([tool, count]) => (
                      <span key={tool} className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full">
                        {tool}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-[var(--text-muted)]">No audit data yet</div>
            )}
          </div>
        </div>

        {/* Disks + Recent Activity */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Disks */}
          {disks.length > 0 && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">💾 Disks</h3>
              <div className="space-y-3">
                {disks.map((d) => (
                  <div key={d.drive}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{d.drive}</span>
                      <span className="text-xs text-[var(--text-muted)]">{d.used} / {d.total}</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${d.percent > 90 ? "bg-red-500" : d.percent > 70 ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${d.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Tool Calls */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">🔧 Recent Tool Calls</h3>
            {recentTools.length > 0 ? (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {recentTools.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[var(--bg-hover)]">
                    <span className={`w-1.5 h-1.5 rounded-full ${t.success ? "bg-green-500" : "bg-red-500"}`} />
                    <code className="text-xs font-mono text-[var(--text-primary)] flex-1 truncate">{t.tool}</code>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(t.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[var(--text-muted)]">No recent activity</div>
            )}
          </div>
        </div>

        {/* Top Processes */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">📊 Top Processes</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {processes.slice(0, 8).map((p, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded bg-[var(--bg-primary)]">
                <span className="text-[10px] text-[var(--text-muted)] w-3">{i + 1}</span>
                <span className="text-xs text-[var(--text-primary)] flex-1 truncate font-mono">{p.name}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{p.memoryMB}MB</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/help", icon: "🔧", label: "Tools", desc: "73 tools" },
            { href: "/settings", icon: "⚙️", label: "Settings", desc: "LLM config" },
            { href: "/workflows", icon: "⚡", label: "Workflows", desc: "9 workflows" },
            { href: "/audit", icon: "📋", label: "Audit Log", desc: "Activity" },
          ].map((link) => (
            <Link key={link.href} href={link.href}
              className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 hover:border-purple-400 transition-colors"
            >
              <span className="text-2xl">{link.icon}</span>
              <div className="mt-2">
                <div className="text-sm font-medium text-[var(--text-primary)]">{link.label}</div>
                <div className="text-xs text-[var(--text-muted)]">{link.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
