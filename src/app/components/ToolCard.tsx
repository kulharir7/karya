"use client";

import { useState } from "react";

interface ToolCardProps {
  toolName: string;
  status: "running" | "done" | "error";
  args?: any;
  result?: any;
}

const TOOL_ICONS: Record<string, string> = {
  "browser-navigate": "🌐", "browser-act": "👆", "browser-extract": "📊",
  "browser-screenshot": "📸", "web-search": "🔍", "browser-agent": "🤖",
  "file-read": "📖", "file-write": "✏️", "file-list": "📁",
  "file-move": "📦", "file-search": "🔎", "file-read-pdf": "📄",
  "file-resize-image": "🖼️", "file-zip": "🗜️", "file-unzip": "📂",
  "file-batch-rename": "✏️", "file-size-info": "📏",
  "shell-execute": "💻", "system-info": "🖥️",
  "clipboard-read": "📋", "clipboard-write": "📝", "system-notify": "🔔",
};

function formatToolName(name: string): string {
  return name.replace(/^(browser|file|shell|system)-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ToolCard({ toolName, status, args, result }: ToolCardProps) {
  const [open, setOpen] = useState(false);
  const icon = TOOL_ICONS[toolName] || "🔧";

  return (
    <div className={`rounded-lg border overflow-hidden my-1.5 ${
      status === "running" ? "border-amber-300 bg-amber-50" : "border-amber-200 bg-amber-50/60"
    }`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-amber-100/50 transition-colors text-left"
      >
        {status === "running" ? (
          <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin shrink-0" />
        ) : (
          <span className="text-amber-600 text-xs shrink-0">✦</span>
        )}

        <span className="text-xs text-gray-600 flex-1">
          <span className="font-medium text-gray-800">
            {status === "running" ? "Running" : "Tool output"}
          </span>
          {" "}
          <span className="text-gray-500">{toolName}</span>
        </span>

        <span className={`text-gray-400 text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="px-3.5 pb-3 space-y-2 border-t border-amber-200/60">
          {args && Object.keys(args).length > 0 && (
            <div className="mt-2">
              <span className="text-[10px] font-medium text-blue-600 uppercase">Input</span>
              <pre className="text-[11px] text-gray-600 bg-white/80 rounded-md p-2.5 overflow-x-auto max-h-28 mt-1 font-mono border border-gray-100">
                {typeof args === "string" ? args : JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <span className="text-[10px] font-medium text-green-600 uppercase">Output</span>
              <pre className="text-[11px] text-gray-600 bg-white/80 rounded-md p-2.5 overflow-x-auto max-h-40 mt-1 font-mono border border-gray-100">
                {typeof result === "string" ? result.slice(0, 2000) : JSON.stringify(result, null, 2).slice(0, 2000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
