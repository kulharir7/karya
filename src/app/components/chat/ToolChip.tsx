"use client";

import { useState } from "react";
import type { ToolCall } from "@/app/hooks/useChat";

// ---- Tool metadata for display ----
const TOOL_META: Record<string, { icon: string; label: string }> = {
  "browser-navigate": { icon: "🌐", label: "Navigate" }, "browser-act": { icon: "👆", label: "Page Action" },
  "browser-extract": { icon: "📊", label: "Extract" }, "browser-screenshot": { icon: "📸", label: "Screenshot" },
  "web-search": { icon: "🔍", label: "Search" }, "browser-agent": { icon: "🤖", label: "Browser Agent" },
  "file-read": { icon: "📖", label: "Read File" }, "file-write": { icon: "✏️", label: "Write File" },
  "file-list": { icon: "📁", label: "List Files" }, "file-move": { icon: "📦", label: "Move" },
  "file-search": { icon: "🔎", label: "Find Files" }, "shell-execute": { icon: "💻", label: "Command" },
  "system-info": { icon: "🖥️", label: "System Info" }, "system-datetime": { icon: "🕐", label: "Time" },
  "code-write": { icon: "📝", label: "Write Code" }, "code-execute": { icon: "▶️", label: "Run Code" },
  "code-analyze": { icon: "🔬", label: "Analyze Code" }, "api-call": { icon: "🌐", label: "API Call" },
  "memory-search": { icon: "🧠", label: "Memory" }, "memory-write": { icon: "✏️", label: "Save Memory" },
  "memory-log": { icon: "📝", label: "Log" }, "git-status": { icon: "🔀", label: "Git Status" },
  "git-commit": { icon: "💾", label: "Commit" }, "git-push": { icon: "🚀", label: "Push" },
  "git-diff": { icon: "📝", label: "Diff" }, "git-log": { icon: "📜", label: "Git Log" },
  "task-schedule": { icon: "⏰", label: "Schedule" }, "trigger-create": { icon: "⚡", label: "Trigger" },
  "skill-load": { icon: "📖", label: "Skill" }, "skill-list": { icon: "📚", label: "Skills" },
  "workflow-run": { icon: "⚙️", label: "Workflow" }, "plugin-list": { icon: "🔌", label: "Plugins" },
};

/** Tools that should be completely HIDDEN (internal, not user-facing) */
const HIDDEN_TOOLS = new Set([
  "memory-search", "memory-read", "memory-recall", "memory-list",
  "skill-match", "skill-load", "confidence-check",
  "suggest-recovery", "log-recovery", "pass-context", "memory-log",
]);

/** Get one-liner summary for a tool result */
function getResultSummary(toolName: string, result: any): string | null {
  if (!result) return null;
  if (result.blocked) return "🔒 Blocked";

  const summaries: Record<string, (r: any) => string> = {
    "file-write": (r) => r.path ? `→ ${r.path.split(/[\\/]/).pop()}` : "",
    "code-write": (r) => r.path ? `→ ${r.path.split(/[\\/]/).pop()} (${r.lines} lines)` : "",
    "web-search": (r) => r.results?.length ? `${r.results.length} results` : "",
    "browser-navigate": (r) => r.title ? `→ ${r.title.slice(0, 40)}` : "",
    "shell-execute": (r) => r.output ? r.output.split("\n")[0].slice(0, 50) : "",
    "git-commit": (r) => r.output ? r.output.slice(0, 40) : "",
    "git-push": (r) => r.success ? "✓ pushed" : "",
    "system-info": () => "",
    "system-screenshot": (r) => r.success ? "captured" : "",
  };

  return summaries[toolName]?.(result) || null;
}

// ---- COMPONENTS ----

/** Inline tool chip — compact one-liner */
function ToolChipInline({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TOOL_META[tool.toolName] || { icon: "🔧", label: tool.toolName };
  const isRunning = tool.status === "running";
  const summary = !isRunning ? getResultSummary(tool.toolName, tool.result) : null;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
          isRunning
            ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
            : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
        }`}
      >
        {isRunning ? (
          <div className="w-3 h-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        ) : (
          <span className="text-green-500 text-[10px]">✓</span>
        )}
        <span>{meta.icon}</span>
        <span className="font-medium">{meta.label}</span>
        {summary && <span className="text-[var(--text-muted)] ml-0.5">{summary}</span>}
        {!isRunning && (
          <svg width="8" height="8" viewBox="0 0 12 12" className={`transition-transform ${expanded ? "rotate-180" : ""}`}>
            <path d="M3 5L6 8L9 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && !isRunning && (
        <div className="mt-1.5 ml-2 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs">
          {tool.args && Object.keys(tool.args).length > 0 && (
            <div className="mb-2">
              <span className="text-[var(--text-muted)] font-medium">Input:</span>
              <pre className="mt-1 text-[var(--text-secondary)] font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                {JSON.stringify(tool.args, null, 2).slice(0, 500)}
              </pre>
            </div>
          )}
          {tool.result && (
            <div>
              <span className="text-[var(--text-muted)] font-medium">Output:</span>
              <pre className="mt-1 text-[var(--text-secondary)] font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                {(typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result, null, 2)).slice(0, 1000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- MAIN EXPORT ----

/** Render tool calls as a row of chips */
export default function ToolChips({ tools }: { tools: ToolCall[] }) {
  // Filter out hidden tools
  const visibleTools = tools.filter((t) => !HIDDEN_TOOLS.has(t.toolName));

  if (visibleTools.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {visibleTools.map((tool, i) => (
        <ToolChipInline key={`${tool.toolName}-${i}`} tool={tool} />
      ))}
    </div>
  );
}
