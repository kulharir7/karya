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

export default function Dashboard() {
  const [system, setSystem] = useState<SystemData | null>(null);
  const [disks, setDisks] = useState<DiskInfo[]>([]);
  const [processes, setProcesses] = useState<{ name: string; pid: number; memoryMB: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/system").then((r) => r.json()),
      fetch("/api/dashboard/disks").then((r) => r.json()),
      fetch("/api/dashboard/processes").then((r) => r.json()),
    ]).then(([sys, dsk, proc]) => {
      setSystem(sys);
      setDisks(dsk.disks || []);
      setProcesses(proc.processes || []);
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
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Back</Link>
          <span className="text-[var(--text-muted)]">·</span>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">System Dashboard</h1>
          <div className="flex-1" />
          <span className="text-xs text-[var(--text-muted)] font-mono">{time.toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Top Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "OS", value: system?.os?.replace("Windows_NT ", "Win ") || "—", icon: "🖥️" },
            { label: "CPU", value: `${system?.cpus || 0} cores`, icon: "⚡" },
            { label: "Memory", value: `${memUsed.toFixed(1)} / ${system?.totalMemoryGB || 0} GB`, icon: "🧠" },
            { label: "Host", value: system?.hostname || "—", icon: "🏠" },
          ].map((c) => (
            <div key={c.label} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{c.icon}</span>
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">{c.label}</span>
              </div>
              <p className="text-lg font-bold text-[var(--text-primary)]">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Memory Bar */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Memory Usage</span>
            <span className="text-xs text-[var(--text-muted)]">{memPercent}%</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${memPercent > 80 ? "bg-red-500" : memPercent > 60 ? "bg-amber-500" : "bg-green-500"}`}
              style={{ width: `${memPercent}%` }}
            />
          </div>
        </div>

        {/* Disks */}
        {disks.length > 0 && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">💾 Disk Usage</h3>
            <div className="space-y-3">
              {disks.map((d) => (
                <div key={d.drive}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{d.drive}</span>
                    <span className="text-xs text-[var(--text-muted)]">{d.used} / {d.total} ({d.percent}%)</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${d.percent > 90 ? "bg-red-500" : d.percent > 70 ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${d.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Processes */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">📊 Top Processes (by Memory)</h3>
          <div className="space-y-1">
            {processes.slice(0, 12).map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-[var(--bg-hover)] transition-colors">
                <span className="text-[10px] text-[var(--text-muted)] w-4 text-right">{i + 1}</span>
                <span className="text-sm text-[var(--text-primary)] flex-1 truncate font-mono">{p.name}</span>
                <span className="text-xs text-[var(--text-muted)]">PID {p.pid}</span>
                <span className="text-xs font-medium text-[var(--text-secondary)] w-20 text-right">{p.memoryMB} MB</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
