"use client";

import { useState } from "react";

interface ToolCardProps {
  toolName: string;
  status: "running" | "done" | "error";
  args?: any;
  result?: any;
}

const TOOL_ICONS: Record<string, string> = {
  "browser-navigate": "🌐",
  "browser-act": "👆",
  "browser-extract": "📊",
  "browser-screenshot": "📸",
  "web-search": "🔍",
  "file-read": "📖",
  "file-write": "✏️",
  "file-list": "📁",
  "file-move": "📦",
  "file-search": "🔎",
  "file-read-pdf": "📄",
  "file-resize-image": "🖼️",
  "file-zip": "🗜️",
  "file-unzip": "📂",
  "shell-execute": "💻",
  "system-info": "🖥️",
  "clipboard-read": "📋",
  "clipboard-write": "📝",
  "system-notify": "🔔",
  "browser-agent": "🤖",
  "file-batch-rename": "✏️",
  "file-size-info": "📏",
};

function formatToolName(name: string): string {
  return name
    .replace(/^(browser|file|shell|system)-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "...";
}

export default function ToolCard({ toolName, status, args, result }: ToolCardProps) {
  const [open, setOpen] = useState(false);
  const icon = TOOL_ICONS[toolName] || "🔧";
  const displayName = formatToolName(toolName);

  return (
    <div
      className={`rounded-xl border overflow-hidden my-2 transition-all ${
        status === "running"
          ? "border-orange-500/40 bg-orange-500/5"
          : status === "error"
          ? "border-red-500/40 bg-red-500/5"
          : "border-[var(--border)] bg-[var(--bg-secondary)]"
      }`}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        {/* Status indicator */}
        {status === "running" ? (
          <div className="w-5 h-5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin shrink-0" />
        ) : status === "done" ? (
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
            <span className="text-green-400 text-xs">✓</span>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <span className="text-red-400 text-xs">✗</span>
          </div>
        )}

        {/* Tool info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">{icon}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {status === "running" ? `Using ${displayName}...` : `Used ${displayName}`}
            </span>
          </div>
          {/* Quick preview of args */}
          {args && !open && (
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
              {truncate(
                typeof args === "string" ? args : JSON.stringify(args),
                80
              )}
            </p>
          )}
        </div>

        {/* Expand arrow */}
        <span
          className={`text-[var(--text-secondary)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-3 space-y-2 border-t border-[var(--border)]">
          {/* Input */}
          {args && (
            <div className="mt-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-semibold text-blue-400 uppercase">
                  📥 Input
                </span>
              </div>
              <pre className="text-xs text-[var(--text-secondary)] bg-black/20 rounded-lg p-3 overflow-x-auto max-h-40 font-mono">
                {typeof args === "string"
                  ? args
                  : JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}

          {/* Output */}
          {result && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-semibold text-green-400 uppercase">
                  📤 Output
                </span>
              </div>
              <pre className="text-xs text-green-400/80 bg-black/20 rounded-lg p-3 overflow-x-auto max-h-48 font-mono">
                {truncate(
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2),
                  2000
                )}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
