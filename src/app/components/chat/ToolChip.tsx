"use client";

import { useState } from "react";
import type { ToolCall } from "@/app/hooks/useChat";

// ============================================
// TOOL METADATA — ALL 82 TOOLS
// ============================================

const TOOL_META: Record<string, { icon: string; label: string }> = {
  // Browser
  "browser-navigate": { icon: "🌐", label: "Navigate" },
  "browser-act": { icon: "👆", label: "Action" },
  "browser-extract": { icon: "📊", label: "Extract" },
  "browser-screenshot": { icon: "📸", label: "Screenshot" },
  "web-search": { icon: "🔍", label: "Search" },
  "browser-agent": { icon: "🤖", label: "Browser Agent" },
  // Files
  "file-read": { icon: "📖", label: "Read File" },
  "file-write": { icon: "✏️", label: "Write File" },
  "file-list": { icon: "📁", label: "List Files" },
  "file-move": { icon: "📦", label: "Move" },
  "file-search": { icon: "🔎", label: "Find Files" },
  "file-read-pdf": { icon: "📄", label: "Read PDF" },
  "file-resize-image": { icon: "🖼️", label: "Resize Image" },
  "file-zip": { icon: "🗜️", label: "ZIP" },
  "file-unzip": { icon: "📂", label: "Unzip" },
  "file-batch-rename": { icon: "✏️", label: "Rename" },
  "file-size-info": { icon: "📏", label: "Size Info" },
  // Shell & System
  "shell-execute": { icon: "💻", label: "Command" },
  "system-info": { icon: "🖥️", label: "System Info" },
  "system-datetime": { icon: "🕐", label: "Time" },
  "system-processes": { icon: "📊", label: "Processes" },
  "system-open-app": { icon: "🚀", label: "Open App" },
  "system-kill-process": { icon: "⛔", label: "Kill Process" },
  "clipboard-read": { icon: "📋", label: "Clipboard" },
  "clipboard-write": { icon: "📝", label: "Copy" },
  "system-notify": { icon: "🔔", label: "Notify" },
  "system-screenshot": { icon: "📸", label: "Screen Capture" },
  "analyze-image": { icon: "👁️", label: "Vision" },
  // Code
  "code-write": { icon: "📝", label: "Write Code" },
  "code-execute": { icon: "▶️", label: "Run Code" },
  "code-analyze": { icon: "🔬", label: "Analyze" },
  // Data
  "api-call": { icon: "🌐", label: "API Call" },
  "data-csv-parse": { icon: "📊", label: "Parse CSV" },
  "data-json-query": { icon: "🔎", label: "Query JSON" },
  "data-transform": { icon: "🔄", label: "Transform" },
  // Memory
  "memory-search": { icon: "🧠", label: "Memory" },
  "memory-read": { icon: "📖", label: "Read Memory" },
  "memory-write": { icon: "✏️", label: "Save Memory" },
  "memory-log": { icon: "📝", label: "Log" },
  "memory-list": { icon: "📋", label: "Memory Files" },
  "memory-recall": { icon: "🔮", label: "Recall" },
  // Git
  "git-status": { icon: "🔀", label: "Git Status" },
  "git-commit": { icon: "💾", label: "Commit" },
  "git-push": { icon: "🚀", label: "Push" },
  "git-log": { icon: "📜", label: "Git Log" },
  "git-diff": { icon: "📝", label: "Diff" },
  // Scheduler
  "task-schedule": { icon: "⏰", label: "Schedule" },
  "task-list": { icon: "📋", label: "Tasks" },
  "task-cancel": { icon: "❌", label: "Cancel Task" },
  // Agents
  "delegate-browser-agent": { icon: "🌐", label: "→ Browser" },
  "delegate-file-agent": { icon: "📁", label: "→ Files" },
  "delegate-coder-agent": { icon: "💻", label: "→ Coder" },
  "delegate-researcher-agent": { icon: "🔍", label: "→ Research" },
  "delegate-data-analyst-agent": { icon: "📊", label: "→ Data" },
  "pass-context": { icon: "📤", label: "Context" },
  "agent-handoff": { icon: "🔗", label: "Handoff" },
  "code-review": { icon: "🔍", label: "Review" },
  // Planning
  "create-plan": { icon: "📋", label: "Plan" },
  "execute-plan-step": { icon: "▶️", label: "Execute Step" },
  "review-output": { icon: "🔍", label: "Self-Review" },
  "get-plan-status": { icon: "📊", label: "Plan Status" },
  // Recovery
  "suggest-recovery": { icon: "🔄", label: "Recovery" },
  "log-recovery": { icon: "✅", label: "Log Recovery" },
  "confidence-check": { icon: "🎯", label: "Confidence" },
  // Skills
  "skill-list": { icon: "📚", label: "Skills" },
  "skill-match": { icon: "🔍", label: "Match Skill" },
  "skill-load": { icon: "📖", label: "Load Skill" },
  "skill-create": { icon: "✨", label: "Create Skill" },
  // Workflows
  "workflow-list": { icon: "⚙️", label: "Workflows" },
  "workflow-run": { icon: "▶️", label: "Run Workflow" },
  "workflow-status": { icon: "📊", label: "WF Status" },
  "workflow-history": { icon: "📜", label: "WF History" },
  "workflow-resume": { icon: "▶️", label: "Resume WF" },
  "workflow-cancel": { icon: "⛔", label: "Cancel WF" },
  "workflow-stats": { icon: "📊", label: "WF Stats" },
  // Triggers
  "trigger-create": { icon: "⚡", label: "Create Trigger" },
  "trigger-list": { icon: "📋", label: "Triggers" },
  "trigger-delete": { icon: "🗑️", label: "Delete Trigger" },
  "trigger-toggle": { icon: "🔘", label: "Toggle Trigger" },
  // Plugins
  "plugin-list": { icon: "🔌", label: "Plugins" },
  "plugin-create": { icon: "✨", label: "Create Plugin" },
  "plugin-install": { icon: "📥", label: "Install Plugin" },
  "plugin-toggle": { icon: "🔘", label: "Toggle Plugin" },
  "plugin-uninstall": { icon: "🗑️", label: "Uninstall" },
};

// ============================================
// HIDDEN TOOLS (internal, never shown to user)
// ============================================

const HIDDEN_TOOLS = new Set([
  "memory-search", "memory-read", "memory-recall", "memory-list", "memory-log",
  "skill-match", "skill-load",
  "confidence-check", "suggest-recovery", "log-recovery",
  "pass-context", "get-plan-status", "review-output",
]);

// ============================================
// RESULT SUMMARIES (one-liner for chip display)
// ============================================

function getResultSummary(toolName: string, result: any): string | null {
  if (!result) return null;
  if (result.blocked) return "🔒 Blocked";
  if (result.success === false && result.error) return `❌ ${result.error.slice(0, 40)}`;

  try {
    switch (toolName) {
      // Files
      case "file-write":
      case "code-write":
        return result.path ? `→ ${basename(result.path)}${result.lines ? ` (${result.lines} lines)` : ""}` : null;
      case "file-read":
        return result.size ? `${formatSize(result.size)}` : null;
      case "file-list":
        return result.count !== undefined ? `${result.count} items` : null;
      case "file-move":
        return result.to ? `→ ${basename(result.to)}` : null;
      case "file-search":
        return result.count !== undefined ? `${result.count} found` : null;

      // Browser
      case "browser-navigate":
        return result.title ? `→ ${result.title.slice(0, 35)}` : null;
      case "web-search":
        return result.results?.length ? `${result.results.length} results` : null;
      case "browser-extract":
        return result.success ? "data extracted" : null;

      // Shell
      case "shell-execute":
        if (result.output) {
          const firstLine = result.output.split("\n")[0].trim();
          return firstLine.length > 50 ? firstLine.slice(0, 47) + "..." : firstLine;
        }
        return result.exitCode === 0 ? "✓ done" : `exit ${result.exitCode}`;

      // Code
      case "code-execute":
        return result.output ? result.output.split("\n")[0].slice(0, 40) : null;

      // Git
      case "git-status":
        return result.output ? result.output.split("\n")[0].slice(0, 40) : null;
      case "git-commit":
        return result.output?.includes("commit") ? result.output.match(/[a-f0-9]{7}/)?.[0] || "✓" : null;
      case "git-push":
        return result.success ? "✓ pushed" : null;
      case "git-diff":
        return result.output ? `${result.output.split("\n").length} lines` : null;

      // System
      case "system-info":
        return null; // Agent will describe it
      case "system-screenshot":
        return result.success ? "captured" : null;
      case "clipboard-write":
        return result.success ? "✓ copied" : null;
      case "system-notify":
        return result.success ? "✓ sent" : null;

      // Data
      case "api-call":
        return result.status ? `HTTP ${result.status}` : null;
      case "data-csv-parse":
        return result.rows ? `${result.rows} rows` : null;

      // Tasks/Workflows
      case "task-schedule":
        return result.id ? `scheduled` : null;
      case "workflow-run":
        return result.runId ? `started` : null;

      // Plugins/Skills
      case "skill-list":
      case "plugin-list":
        return result.count !== undefined ? `${result.count} available` : null;
      case "skill-create":
      case "plugin-create":
        return result.success ? "✓ created" : null;
      case "trigger-create":
        return result.success ? "✓ active" : null;

      default:
        return null;
    }
  } catch {
    return null;
  }
}

function basename(p: string): string {
  return p.split(/[\\/]/).pop() || p;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================
// RICH RESULT DISPLAY (expandable detail)
// ============================================

function RichResult({ toolName, result }: { toolName: string; result: any }) {
  if (!result) return null;

  // Web search — show result titles
  if (toolName === "web-search" && result.results?.length) {
    return (
      <div className="space-y-1.5">
        {result.results.slice(0, 3).map((r: any, i: number) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-[var(--text-muted)] shrink-0">{i + 1}.</span>
            <div className="min-w-0">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline text-xs font-medium truncate block">{r.title}</a>
              {r.snippet && <p className="text-[10px] text-[var(--text-muted)] line-clamp-1">{r.snippet}</p>}
            </div>
          </div>
        ))}
        {result.results.length > 3 && <p className="text-[10px] text-[var(--text-muted)]">+{result.results.length - 3} more</p>}
      </div>
    );
  }

  // File list — show files
  if (toolName === "file-list" && result.files?.length) {
    return (
      <div className="space-y-0.5">
        {result.files.slice(0, 8).map((f: string, i: number) => (
          <div key={i} className="text-xs text-[var(--text-secondary)] font-mono">{f}</div>
        ))}
        {result.files.length > 8 && <p className="text-[10px] text-[var(--text-muted)]">+{result.files.length - 8} more</p>}
      </div>
    );
  }

  // Shell output — show output
  if ((toolName === "shell-execute" || toolName === "code-execute") && result.output) {
    return (
      <pre className="text-xs text-[var(--text-secondary)] font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{result.output.slice(0, 800)}</pre>
    );
  }

  // Generic: show as JSON
  const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  return (
    <pre className="text-xs text-[var(--text-secondary)] font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{text.slice(0, 1000)}</pre>
  );
}

// ============================================
// TOOL CHIP COMPONENT
// ============================================

function ToolChipItem({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TOOL_META[tool.toolName] || { icon: "🔧", label: tool.toolName };
  const isRunning = tool.status === "running";
  const isError = tool.status === "error" || tool.result?.success === false;
  const summary = !isRunning ? getResultSummary(tool.toolName, tool.result) : null;

  return (
    <div>
      <button
        onClick={() => !isRunning && setExpanded(!expanded)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
          isRunning
            ? "bg-amber-500/10 text-amber-600 border border-amber-500/20 cursor-default"
            : isError
            ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:border-red-400"
            : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text-primary)] cursor-pointer"
        }`}
      >
        {isRunning ? (
          <div className="w-3 h-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        ) : isError ? (
          <span className="text-red-400 text-[10px]">✗</span>
        ) : (
          <span className="text-green-500 text-[10px]">✓</span>
        )}
        <span>{meta.icon}</span>
        <span className="font-medium">{meta.label}</span>
        {summary && <span className="text-[var(--text-muted)] ml-0.5">{summary}</span>}
        {!isRunning && (
          <svg width="8" height="8" viewBox="0 0 12 12" className={`transition-transform ml-0.5 ${expanded ? "rotate-180" : ""}`}>
            <path d="M3 5L6 8L9 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {expanded && !isRunning && (
        <div className="mt-1.5 ml-2 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)]">
          {/* Args summary (if any) */}
          {tool.args && Object.keys(tool.args).length > 0 && (
            <div className="mb-2">
              <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">Input</span>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {Object.entries(tool.args).slice(0, 5).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-[var(--text-muted)] shrink-0">{k}:</span>
                    <span className="font-mono truncate">{String(v).slice(0, 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Rich result */}
          {tool.result && (
            <div>
              <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">Output</span>
              <div className="mt-1">
                <RichResult toolName={tool.toolName} result={tool.result} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN EXPORT
// ============================================

export default function ToolChips({ tools }: { tools: ToolCall[] }) {
  const visibleTools = tools.filter((t) => !HIDDEN_TOOLS.has(t.toolName));
  if (visibleTools.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {visibleTools.map((tool, i) => (
        <ToolChipItem key={`${tool.toolName}-${i}`} tool={tool} />
      ))}
    </div>
  );
}
