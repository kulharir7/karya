"use client";
import { useState } from "react";
import Link from "next/link";

const TOOLS = [
  { cat: "🌐 Browser", icon: "🌐", tools: [
    { name: "browser-navigate", desc: "Open any URL in browser" },
    { name: "browser-act", desc: "Click, type, scroll on page" },
    { name: "browser-extract", desc: "Extract data from webpage" },
    { name: "browser-screenshot", desc: "Capture webpage screenshot" },
    { name: "web-search", desc: "DuckDuckGo web search" },
    { name: "browser-agent", desc: "Multi-step browser automation" },
  ]},
  { cat: "📁 Files", icon: "📁", tools: [
    { name: "file-read", desc: "Read text file contents" },
    { name: "file-write", desc: "Create or write files" },
    { name: "file-list", desc: "List directory contents" },
    { name: "file-move", desc: "Move or rename files" },
    { name: "file-search", desc: "Find files by pattern" },
    { name: "file-read-pdf", desc: "Extract PDF text" },
    { name: "file-resize-image", desc: "Resize/compress images" },
    { name: "file-zip", desc: "Create ZIP archives" },
    { name: "file-unzip", desc: "Extract ZIP files" },
    { name: "file-batch-rename", desc: "Bulk rename files" },
    { name: "file-size-info", desc: "Get file/folder sizes" },
  ]},
  { cat: "💻 Shell", icon: "💻", tools: [
    { name: "shell-execute", desc: "Run PowerShell commands" },
    { name: "system-kill-process", desc: "Kill a running process" },
  ]},
  { cat: "🖥️ System", icon: "🖥️", tools: [
    { name: "system-info", desc: "OS, CPU, RAM info" },
    { name: "system-datetime", desc: "Current date & time" },
    { name: "system-processes", desc: "List running processes" },
    { name: "system-open-app", desc: "Open apps/files/URLs" },
    { name: "system-screenshot", desc: "Capture screen" },
    { name: "analyze-image", desc: "Analyze image with vision" },
    { name: "clipboard-read", desc: "Read clipboard content" },
    { name: "clipboard-write", desc: "Write to clipboard" },
    { name: "system-notify", desc: "Desktop notification" },
  ]},
  { cat: "💾 Code", icon: "💾", tools: [
    { name: "code-write", desc: "Write code files" },
    { name: "code-execute", desc: "Execute JavaScript code" },
    { name: "code-analyze", desc: "Analyze code structure" },
  ]},
  { cat: "📊 Data", icon: "📊", tools: [
    { name: "api-call", desc: "Make HTTP API requests" },
    { name: "csv-parse", desc: "Parse CSV data" },
    { name: "json-query", desc: "Query JSON with JSONPath" },
    { name: "data-transform", desc: "Transform data formats" },
  ]},
  { cat: "🧠 Memory", icon: "🧠", tools: [
    { name: "memory-search", desc: "Semantic search in memory" },
    { name: "memory-read", desc: "Read memory file" },
    { name: "memory-write", desc: "Update memory file" },
    { name: "memory-log", desc: "Log to daily file" },
    { name: "memory-list", desc: "List memory files" },
    { name: "memory-recall", desc: "Recall with embeddings" },
  ]},
  { cat: "🔀 Git", icon: "🔀", tools: [
    { name: "git-status", desc: "Check repo status" },
    { name: "git-commit", desc: "Commit changes" },
    { name: "git-push", desc: "Push to remote" },
    { name: "git-log", desc: "View commit history" },
    { name: "git-diff", desc: "Show changes" },
  ]},
  { cat: "⏰ Scheduler", icon: "⏰", tools: [
    { name: "task-schedule", desc: "Schedule cron/interval task" },
    { name: "task-list", desc: "List scheduled tasks" },
    { name: "task-cancel", desc: "Cancel a task" },
  ]},
  { cat: "🤖 Agents", icon: "🤖", tools: [
    { name: "delegate-browser-agent", desc: "Delegate to browser expert" },
    { name: "delegate-file-agent", desc: "Delegate to file expert" },
    { name: "delegate-coder-agent", desc: "Delegate to coder expert" },
    { name: "delegate-researcher-agent", desc: "Delegate to research expert" },
    { name: "delegate-data-analyst", desc: "Delegate to data expert" },
    { name: "pass-context", desc: "Pass context between agents" },
    { name: "agent-handoff", desc: "Handoff to another agent" },
    { name: "code-review", desc: "Request code review" },
  ]},
  { cat: "📋 Planning", icon: "📋", tools: [
    { name: "create-plan", desc: "Create multi-step plan" },
    { name: "execute-plan-step", desc: "Execute a plan step" },
    { name: "review-output", desc: "Review agent output" },
    { name: "get-plan-status", desc: "Check plan progress" },
  ]},
  { cat: "🔄 Recovery", icon: "🔄", tools: [
    { name: "suggest-recovery", desc: "Suggest error recovery" },
    { name: "log-recovery", desc: "Log recovery attempt" },
  ]},
  { cat: "🎯 Confidence", icon: "🎯", tools: [
    { name: "confidence-check", desc: "Check task confidence" },
  ]},
  { cat: "📦 Skills", icon: "📦", tools: [
    { name: "skill-list", desc: "List available skills" },
    { name: "skill-match", desc: "Find matching skill" },
    { name: "skill-load", desc: "Load skill instructions" },
    { name: "skill-create", desc: "Create new skill" },
  ]},
  { cat: "⚡ Workflows", icon: "⚡", tools: [
    { name: "workflow-list", desc: "List all workflows" },
    { name: "workflow-run", desc: "Run a workflow" },
    { name: "workflow-status", desc: "Check workflow status" },
    { name: "workflow-history", desc: "View run history" },
    { name: "workflow-resume", desc: "Resume paused workflow" },
    { name: "workflow-cancel", desc: "Cancel running workflow" },
    { name: "workflow-stats", desc: "Workflow statistics" },
  ]},
];

const WORKFLOWS = [
  { name: "web-scraper", pattern: ".then()", desc: "Scrape data from multiple URLs" },
  { name: "file-organizer", pattern: ".then()", desc: "Organize files by type/date" },
  { name: "data-processor", pattern: ".branch()", desc: "Process data with conditions" },
  { name: "research-pipeline", pattern: ".then()", desc: "Multi-source research" },
  { name: "backup", pattern: ".then()", desc: "Backup files to archive" },
  { name: "multi-source-research", pattern: ".parallel()", desc: "Parallel web research" },
  { name: "file-cleanup", pattern: "suspend/resume", desc: "Human-approved file deletion" },
  { name: "batch-image-processor", pattern: ".foreach()", desc: "Batch resize images" },
  { name: "url-monitor", pattern: ".dountil()", desc: "Monitor URL for changes" },
];

const SHORTCUTS = [
  { key: "Enter", desc: "Send message" },
  { key: "Shift+Enter", desc: "New line" },
  { key: "Ctrl+K", desc: "Command palette" },
  { key: "Drag & Drop", desc: "Upload files" },
  { key: "Ctrl+/", desc: "Toggle sidebar" },
];

const EXAMPLES = [
  { q: "System info batao", desc: "Shows OS, CPU, RAM, username", cat: "System" },
  { q: "Desktop pe kya files hain?", desc: "Lists files on Desktop", cat: "Files" },
  { q: "Downloads mein PDFs dhundho", desc: "Finds all PDF files", cat: "Files" },
  { q: "Chrome kholo", desc: "Opens Chrome browser", cat: "System" },
  { q: "Aaj kya date hai?", desc: "Current date and time", cat: "System" },
  { q: "Clipboard mein kya hai?", desc: "Shows clipboard contents", cat: "System" },
  { q: "Search 'Mastra AI framework'", desc: "Web search", cat: "Browser" },
  { q: "Open github.com", desc: "Opens URL in browser", cat: "Browser" },
  { q: "Desktop pe test.txt banao", desc: "Creates a new file", cat: "Files" },
  { q: "Git status dikhao", desc: "Shows git repo status", cat: "Git" },
  { q: "Kal ka reminder set karo", desc: "Schedule a task", cat: "Scheduler" },
  { q: "Memory mein save karo", desc: "Save to memory file", cat: "Memory" },
];

const totalTools = TOOLS.reduce((sum, cat) => sum + cat.tools.length, 0);

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"tools" | "workflows" | "examples">("tools");

  const filteredTools = TOOLS.map((cat) => ({
    ...cat,
    tools: cat.tools.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.desc.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => cat.tools.length > 0);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Back</Link>
          <span className="text-[var(--text-muted)]">·</span>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">📚 Help & Tools</h1>
          <div className="flex-1" />
          <span className="text-xs text-purple-500 font-medium">{totalTools} tools • 9 workflows</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Intro */}
        <section className="text-center py-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xl mx-auto mb-3 shadow-md">⚡</div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Karya</h2>
          <p className="text-sm text-[var(--text-muted)]">AI Computer Agent — {totalTools} tools to execute real tasks</p>
        </section>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-purple-400"
          />
          <span className="absolute left-3 top-2.5 text-[var(--text-muted)]">🔍</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-[var(--border)] pb-2">
          {[
            { id: "tools", label: `Tools (${totalTools})`, icon: "🔧" },
            { id: "workflows", label: "Workflows (9)", icon: "⚡" },
            { id: "examples", label: "Examples", icon: "💡" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-purple-500/10 text-purple-600"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tools Tab */}
        {activeTab === "tools" && (
          <div className="space-y-4">
            {filteredTools.map((cat) => (
              <div key={cat.cat} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-[var(--bg-primary)] border-b border-[var(--border)]">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{cat.cat}</span>
                  <span className="text-xs text-[var(--text-muted)] ml-2">({cat.tools.length})</span>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {cat.tools.map((t) => (
                    <div key={t.name} className="flex items-center justify-between px-4 py-2 hover:bg-[var(--bg-hover)]">
                      <code className="text-xs font-mono text-purple-500">{t.name}</code>
                      <span className="text-xs text-[var(--text-muted)]">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Workflows Tab */}
        {activeTab === "workflows" && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--bg-primary)] border-b border-[var(--border)]">
              <span className="text-sm font-semibold text-[var(--text-primary)]">⚡ Mastra Workflows</span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {WORKFLOWS.map((w) => (
                <div key={w.name} className="px-4 py-3 hover:bg-[var(--bg-hover)]">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono text-purple-500">{w.name}</code>
                    <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full">{w.pattern}</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{w.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Examples Tab */}
        {activeTab === "examples" && (
          <div className="space-y-4">
            {/* Shortcuts */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-[var(--bg-primary)] border-b border-[var(--border)]">
                <span className="text-sm font-semibold text-[var(--text-primary)]">⌨️ Keyboard Shortcuts</span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {SHORTCUTS.map((s) => (
                  <div key={s.key} className="flex items-center justify-between px-4 py-2">
                    <span className="text-sm text-[var(--text-primary)]">{s.desc}</span>
                    <kbd className="text-xs bg-[var(--bg-primary)] text-[var(--text-secondary)] px-2 py-1 rounded font-mono border border-[var(--border)]">{s.key}</kbd>
                  </div>
                ))}
              </div>
            </div>

            {/* Example Commands */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-[var(--bg-primary)] border-b border-[var(--border)]">
                <span className="text-sm font-semibold text-[var(--text-primary)]">💡 Example Commands</span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {EXAMPLES.map((e) => (
                  <div key={e.q} className="px-4 py-2.5 hover:bg-[var(--bg-hover)]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-[var(--text-primary)]">&ldquo;{e.q}&rdquo;</p>
                      <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full">{e.cat}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{e.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
