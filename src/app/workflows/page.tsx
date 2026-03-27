"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface WorkflowRun {
  runId: string;
  workflowId: string;
  status: "running" | "completed" | "failed" | "suspended";
  startedAt: number;
  completedAt?: number;
  input?: any;
  output?: any;
  error?: string;
}

interface WorkflowStats {
  totalRuns: number;
  running: number;
  completed: number;
  failed: number;
  suspended: number;
}

const WORKFLOWS = [
  { id: "web-scraper", name: "Web Scraper", icon: "🌐", pattern: ".then()", desc: "Scrape data from multiple URLs sequentially" },
  { id: "file-organizer", name: "File Organizer", icon: "📁", pattern: ".then()", desc: "Organize files by type, date, or custom rules" },
  { id: "data-processor", name: "Data Processor", icon: "📊", pattern: ".branch()", desc: "Process data with conditional branching" },
  { id: "research-pipeline", name: "Research Pipeline", icon: "🔍", pattern: ".then()", desc: "Multi-source research with aggregation" },
  { id: "backup", name: "Backup", icon: "💾", pattern: ".then()", desc: "Backup files to ZIP archive" },
  { id: "multi-source-research", name: "Multi-Source Research", icon: "🔬", pattern: ".parallel()", desc: "Parallel research from multiple sources" },
  { id: "file-cleanup", name: "File Cleanup", icon: "🧹", pattern: "suspend/resume", desc: "Human-in-the-loop file deletion" },
  { id: "batch-image-processor", name: "Batch Image Processor", icon: "🖼️", pattern: ".foreach()", desc: "Batch resize/convert images" },
  { id: "url-monitor", name: "URL Monitor", icon: "👁️", pattern: ".dountil()", desc: "Monitor URL until condition met" },
];

export default function WorkflowsPage() {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [runningWorkflow, setRunningWorkflow] = useState<string | null>(null);
  const [workflowInput, setWorkflowInput] = useState("");

  // Load workflow data
  useEffect(() => {
    Promise.all([
      fetch("/api/workflows?action=stats").then((r) => r.json()).catch(() => null),
      fetch("/api/workflows?action=history&limit=20").then((r) => r.json()).catch(() => ({ runs: [] })),
    ]).then(([statsData, historyData]) => {
      setStats(statsData);
      setRuns(historyData.runs || []);
      setLoading(false);
    });
  }, []);

  // Run workflow
  const runWorkflow = async (workflowId: string) => {
    setRunningWorkflow(workflowId);
    try {
      let input = {};
      try {
        input = workflowInput ? JSON.parse(workflowInput) : {};
      } catch {
        // Use as string if not JSON
        input = { input: workflowInput };
      }

      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "run",
          workflowId,
          input,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh runs
        const historyRes = await fetch("/api/workflows?action=history&limit=20");
        const historyData = await historyRes.json();
        setRuns(historyData.runs || []);
      }
    } catch (err) {
      console.error("Failed to run workflow:", err);
    }
    setRunningWorkflow(null);
    setSelectedWorkflow(null);
    setWorkflowInput("");
  };

  // Cancel workflow
  const cancelWorkflow = async (runId: string) => {
    try {
      await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", runId }),
      });
      // Refresh
      const historyRes = await fetch("/api/workflows?action=history&limit=20");
      const historyData = await historyRes.json();
      setRuns(historyData.runs || []);
    } catch (err) {
      console.error("Failed to cancel workflow:", err);
    }
  };

  // Resume workflow
  const resumeWorkflow = async (runId: string) => {
    try {
      await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume", runId, input: { approved: true } }),
      });
      // Refresh
      const historyRes = await fetch("/api/workflows?action=history&limit=20");
      const historyData = await historyRes.json();
      setRuns(historyData.runs || []);
    } catch (err) {
      console.error("Failed to resume workflow:", err);
    }
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
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Back</Link>
          <span className="text-[var(--text-muted)]">·</span>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">⚡ Workflows</h1>
          <div className="flex-1" />
          {stats && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[var(--text-muted)]">{stats.totalRuns} runs</span>
              {stats.running > 0 && (
                <span className="text-blue-500">● {stats.running} running</span>
              )}
              {stats.suspended > 0 && (
                <span className="text-amber-500">● {stats.suspended} suspended</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Workflow Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {WORKFLOWS.map((wf) => (
            <div
              key={wf.id}
              className={`bg-[var(--bg-secondary)] border rounded-xl p-4 transition-all cursor-pointer ${
                selectedWorkflow === wf.id
                  ? "border-purple-500 ring-2 ring-purple-500/20"
                  : "border-[var(--border)] hover:border-purple-300"
              }`}
              onClick={() => setSelectedWorkflow(selectedWorkflow === wf.id ? null : wf.id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{wf.icon}</span>
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{wf.name}</div>
                  <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full">{wf.pattern}</span>
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)]">{wf.desc}</p>

              {/* Run form */}
              {selectedWorkflow === wf.id && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    placeholder="Input (JSON or text)"
                    value={workflowInput}
                    onChange={(e) => setWorkflowInput(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-xs mb-2"
                  />
                  <button
                    onClick={() => runWorkflow(wf.id)}
                    disabled={runningWorkflow === wf.id}
                    className="w-full px-3 py-2 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {runningWorkflow === wf.id ? "Running..." : "▶ Run Workflow"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recent Runs */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">📋 Recent Runs</h3>
          </div>
          
          {runs.length > 0 ? (
            <div className="divide-y divide-[var(--border)]">
              {runs.map((run) => (
                <div key={run.runId} className="px-4 py-3 flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    run.status === "running" ? "bg-blue-500 animate-pulse" :
                    run.status === "completed" ? "bg-green-500" :
                    run.status === "suspended" ? "bg-amber-500" :
                    "bg-red-500"
                  }`} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{run.workflowId}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        run.status === "running" ? "bg-blue-500/10 text-blue-600" :
                        run.status === "completed" ? "bg-green-500/10 text-green-600" :
                        run.status === "suspended" ? "bg-amber-500/10 text-amber-600" :
                        "bg-red-500/10 text-red-600"
                      }`}>
                        {run.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {new Date(run.startedAt).toLocaleString()}
                      {run.completedAt && ` • ${Math.round((run.completedAt - run.startedAt) / 1000)}s`}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {run.status === "running" && (
                      <button
                        onClick={() => cancelWorkflow(run.runId)}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        Cancel
                      </button>
                    )}
                    {run.status === "suspended" && (
                      <button
                        onClick={() => resumeWorkflow(run.runId)}
                        className="text-xs text-amber-600 hover:text-amber-700"
                      >
                        Approve & Resume
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              No workflow runs yet. Click a workflow above to run it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
