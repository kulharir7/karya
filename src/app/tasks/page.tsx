"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Task {
  id: string;
  name: string;
  type: "cron" | "interval" | "once";
  schedule: string;
  action: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  runCount: number;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  
  // Create task form
  const [newTask, setNewTask] = useState({
    name: "",
    type: "interval" as "cron" | "interval" | "once",
    schedule: "5m",
    action: "",
  });

  // Load tasks
  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        setTasks(data.tasks || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Create task
  const createTask = async () => {
    if (!newTask.name || !newTask.action) return;
    
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          name: newTask.name,
          type: newTask.type,
          schedule: newTask.schedule,
          taskAction: newTask.action,
        }),
      });
      
      // Refresh
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
      setShowCreate(false);
      setNewTask({ name: "", type: "interval", schedule: "5m", action: "" });
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  };

  // Toggle task
  const toggleTask = async (id: string, enabled: boolean) => {
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id, enabled }),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, enabled } : t))
      );
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  // Cancel task
  const cancelTask = async (id: string) => {
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", id }),
      });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Failed to cancel task:", err);
    }
  };

  // Run now
  const runNow = async (id: string) => {
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", id }),
      });
    } catch (err) {
      console.error("Failed to run task:", err);
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
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">⏰ Scheduled Tasks</h1>
          <div className="flex-1" />
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
          >
            + New Task
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Create Task Modal */}
        {showCreate && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Create New Task</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Name</label>
                <input
                  type="text"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  placeholder="My Task"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Type</label>
                <select
                  value={newTask.type}
                  onChange={(e) => setNewTask({ ...newTask, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm"
                >
                  <option value="interval">Interval (every X)</option>
                  <option value="cron">Cron (schedule)</option>
                  <option value="once">Once (at time)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Schedule</label>
                <input
                  type="text"
                  value={newTask.schedule}
                  onChange={(e) => setNewTask({ ...newTask, schedule: e.target.value })}
                  placeholder={newTask.type === "cron" ? "0 9 * * *" : newTask.type === "interval" ? "5m" : "2025-01-01T09:00"}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm font-mono"
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  {newTask.type === "interval" && "e.g., 5m, 1h, 30s"}
                  {newTask.type === "cron" && "e.g., 0 9 * * * (9 AM daily)"}
                  {newTask.type === "once" && "ISO timestamp"}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-[var(--text-muted)] mb-1">Action (prompt)</label>
                <textarea
                  value={newTask.action}
                  onChange={(e) => setNewTask({ ...newTask, action: e.target.value })}
                  placeholder="Check for new emails and summarize them"
                  rows={2}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={createTask}
                className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
              >
                Create Task
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tasks List */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Tasks ({tasks.length})
            </h3>
          </div>
          
          {tasks.length > 0 ? (
            <div className="divide-y divide-[var(--border)]">
              {tasks.map((task) => (
                <div key={task.id} className="px-4 py-4 flex items-center gap-4">
                  {/* Status */}
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      task.enabled ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{task.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        task.type === "cron" ? "bg-blue-500/10 text-blue-600" :
                        task.type === "interval" ? "bg-purple-500/10 text-purple-600" :
                        "bg-amber-500/10 text-amber-600"
                      }`}>
                        {task.type}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                      {task.action}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)] mt-1">
                      <span>📅 {task.schedule}</span>
                      <span>🔄 {task.runCount} runs</span>
                      {task.lastRun && (
                        <span>⏱️ Last: {new Date(task.lastRun).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => runNow(task.id)}
                      className="px-2 py-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                    >
                      ▶ Run
                    </button>
                    <button
                      onClick={() => toggleTask(task.id, !task.enabled)}
                      className={`px-2 py-1 text-xs transition-colors ${
                        task.enabled
                          ? "text-amber-600 hover:text-amber-700"
                          : "text-green-600 hover:text-green-700"
                      }`}
                    >
                      {task.enabled ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => cancelTask(task.id)}
                      className="px-2 py-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-12 text-center">
              <span className="text-4xl mb-3 block">⏰</span>
              <p className="text-sm text-[var(--text-muted)]">No scheduled tasks yet</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Create a task to automate recurring actions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
