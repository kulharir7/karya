"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AuditEntry {
  id: number;
  timestamp: number;
  action: string;
  sessionId: string | null;
  tool: string | null;
  input: string | null;
  output: string | null;
  success: boolean;
  duration: number | null;
}

interface AuditStats {
  totalEntries: number;
  byAction: Record<string, number>;
  byTool: Record<string, number>;
  successRate: number;
  avgDuration: number;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ action?: string; tool?: string; success?: boolean }>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Load audit data
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (filter.action) params.set("type", filter.action);
    if (filter.tool) params.set("tool", filter.tool);
    if (filter.success !== undefined) params.set("success", String(filter.success));

    Promise.all([
      fetch(`/api/audit?${params.toString()}`).then((r) => r.json()).catch(() => ({ entries: [] })),
      fetch("/api/audit?action=stats&days=7").then((r) => r.json()).catch(() => null),
    ]).then(([entriesData, statsData]) => {
      setEntries(entriesData.entries || []);
      setStats(statsData);
      setLoading(false);
    });
  }, [filter]);

  const actionColors: Record<string, string> = {
    tool_call: "bg-purple-500/10 text-purple-600",
    tool_error: "bg-red-500/10 text-red-600",
    agent_start: "bg-blue-500/10 text-blue-600",
    agent_end: "bg-green-500/10 text-green-600",
    agent_error: "bg-red-500/10 text-red-600",
    session_create: "bg-cyan-500/10 text-cyan-600",
    session_delete: "bg-gray-500/10 text-gray-600",
    trigger_fire: "bg-amber-500/10 text-amber-600",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Back</Link>
          <span className="text-[var(--text-muted)]">·</span>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">📋 Audit Log</h1>
          <div className="flex-1" />
          {stats && (
            <span className="text-xs text-[var(--text-muted)]">
              {stats.totalEntries} events (7 days) • {stats.successRate}% success
            </span>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Total Events</div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalEntries}</div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Success Rate</div>
              <div className={`text-2xl font-bold ${stats.successRate > 90 ? "text-green-500" : stats.successRate > 70 ? "text-amber-500" : "text-red-500"}`}>
                {stats.successRate}%
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Avg Duration</div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.avgDuration}ms</div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Tool Calls</div>
              <div className="text-2xl font-bold text-purple-500">{stats.byAction?.tool_call || 0}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filter.action || ""}
            onChange={(e) => setFilter({ ...filter, action: e.target.value || undefined })}
            className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs"
          >
            <option value="">All Actions</option>
            <option value="tool_call">Tool Calls</option>
            <option value="tool_error">Tool Errors</option>
            <option value="agent_start">Agent Start</option>
            <option value="agent_end">Agent End</option>
            <option value="session_create">Session Create</option>
            <option value="trigger_fire">Trigger Fire</option>
          </select>

          <select
            value={filter.success === undefined ? "" : String(filter.success)}
            onChange={(e) => setFilter({ ...filter, success: e.target.value === "" ? undefined : e.target.value === "true" })}
            className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs"
          >
            <option value="">All Status</option>
            <option value="true">Success</option>
            <option value="false">Failed</option>
          </select>

          {stats?.byTool && Object.keys(stats.byTool).length > 0 && (
            <select
              value={filter.tool || ""}
              onChange={(e) => setFilter({ ...filter, tool: e.target.value || undefined })}
              className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs"
            >
              <option value="">All Tools</option>
              {Object.entries(stats.byTool).map(([tool, count]) => (
                <option key={tool} value={tool}>{tool} ({count})</option>
              ))}
            </select>
          )}

          {(filter.action || filter.tool || filter.success !== undefined) && (
            <button
              onClick={() => setFilter({})}
              className="px-3 py-1.5 text-xs text-red-500 hover:text-red-600"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Entries List */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
          {entries.length > 0 ? (
            <div className="divide-y divide-[var(--border)]">
              {entries.map((entry) => (
                <div key={entry.id}>
                  <div
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[var(--bg-hover)]"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <span className={`w-2 h-2 rounded-full ${entry.success ? "bg-green-500" : "bg-red-500"}`} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${actionColors[entry.action] || "bg-gray-500/10 text-gray-600"}`}>
                          {entry.action}
                        </span>
                        {entry.tool && (
                          <code className="text-xs font-mono text-purple-500">{entry.tool}</code>
                        )}
                        {entry.duration && (
                          <span className="text-[10px] text-[var(--text-muted)]">{entry.duration}ms</span>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    
                    <span className="text-[var(--text-muted)]">{expandedId === entry.id ? "▼" : "▶"}</span>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === entry.id && (
                    <div className="px-4 py-3 bg-[var(--bg-primary)] border-t border-[var(--border)]">
                      <div className="grid md:grid-cols-2 gap-4 text-xs">
                        {entry.sessionId && (
                          <div>
                            <div className="text-[var(--text-muted)] uppercase text-[10px] mb-1">Session</div>
                            <code className="text-[var(--text-secondary)]">{entry.sessionId}</code>
                          </div>
                        )}
                        {entry.input && (
                          <div>
                            <div className="text-[var(--text-muted)] uppercase text-[10px] mb-1">Input</div>
                            <pre className="text-[var(--text-secondary)] bg-[var(--bg-secondary)] p-2 rounded overflow-auto max-h-32">
                              {entry.input}
                            </pre>
                          </div>
                        )}
                        {entry.output && (
                          <div>
                            <div className="text-[var(--text-muted)] uppercase text-[10px] mb-1">Output</div>
                            <pre className="text-[var(--text-secondary)] bg-[var(--bg-secondary)] p-2 rounded overflow-auto max-h-32">
                              {entry.output}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              No audit entries found. Try changing filters or use Karya to generate activity.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
