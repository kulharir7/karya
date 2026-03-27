"use client";

import { useState } from "react";

interface ToolCardProps {
  toolName: string;
  status: "running" | "done" | "error";
  args?: any;
  result?: any;
}

const TOOL_META: Record<string, { icon: string; label: string; runText: string }> = {
  "browser-navigate": { icon: "🌐", label: "Navigate", runText: "Opening page..." },
  "browser-act": { icon: "👆", label: "Page Action", runText: "Performing action..." },
  "browser-extract": { icon: "📊", label: "Extract Data", runText: "Extracting data..." },
  "browser-screenshot": { icon: "📸", label: "Screenshot", runText: "Capturing screenshot..." },
  "web-search": { icon: "🔍", label: "Web Search", runText: "Searching the web..." },
  "browser-agent": { icon: "🤖", label: "Browser Agent", runText: "Browsing autonomously..." },
  "file-read": { icon: "📖", label: "Read File", runText: "Reading file..." },
  "file-write": { icon: "✏️", label: "Write File", runText: "Writing file..." },
  "file-list": { icon: "📁", label: "List Files", runText: "Listing files..." },
  "file-move": { icon: "📦", label: "Move File", runText: "Moving file..." },
  "file-search": { icon: "🔎", label: "Find Files", runText: "Searching files..." },
  "file-read-pdf": { icon: "📄", label: "Read PDF", runText: "Extracting PDF text..." },
  "file-resize-image": { icon: "🖼️", label: "Resize Image", runText: "Resizing image..." },
  "file-zip": { icon: "🗜️", label: "Create ZIP", runText: "Compressing files..." },
  "file-unzip": { icon: "📂", label: "Extract ZIP", runText: "Extracting archive..." },
  "file-batch-rename": { icon: "✏️", label: "Batch Rename", runText: "Renaming files..." },
  "file-size-info": { icon: "📏", label: "File Size", runText: "Calculating size..." },
  "shell-execute": { icon: "💻", label: "Run Command", runText: "Executing command..." },
  "system-info": { icon: "🖥️", label: "System Info", runText: "Getting system info..." },
  "system-datetime": { icon: "🕐", label: "Date & Time", runText: "Getting time..." },
  "system-processes": { icon: "📊", label: "Processes", runText: "Listing processes..." },
  "system-open-app": { icon: "🚀", label: "Open App", runText: "Opening application..." },
  "system-kill-process": { icon: "⛔", label: "Kill Process", runText: "Stopping process..." },
  "clipboard-read": { icon: "📋", label: "Read Clipboard", runText: "Reading clipboard..." },
  "clipboard-write": { icon: "📝", label: "Write Clipboard", runText: "Writing to clipboard..." },
  "system-notify": { icon: "🔔", label: "Notification", runText: "Sending notification..." },
  "code-write": { icon: "📝", label: "Write Code", runText: "Writing code..." },
  "code-execute": { icon: "▶️", label: "Execute Code", runText: "Running code..." },
  "code-analyze": { icon: "🔬", label: "Analyze Code", runText: "Analyzing code..." },
  "api-call": { icon: "🌐", label: "API Call", runText: "Calling API..." },
  "data-csv-parse": { icon: "📊", label: "Parse CSV", runText: "Parsing CSV..." },
  "data-json-query": { icon: "🔎", label: "Query JSON", runText: "Querying JSON..." },
  "data-transform": { icon: "🔄", label: "Transform Data", runText: "Transforming data..." },
  // Memory
  "memory-search": { icon: "🧠", label: "Search Memory", runText: "Searching memory..." },
  "memory-read": { icon: "📖", label: "Read Memory", runText: "Reading memory..." },
  "memory-write": { icon: "✏️", label: "Write Memory", runText: "Saving to memory..." },
  "memory-log": { icon: "📝", label: "Log Activity", runText: "Logging activity..." },
  "memory-list": { icon: "📋", label: "List Memory", runText: "Listing memory files..." },
  // Scheduler
  "task-schedule": { icon: "⏰", label: "Schedule Task", runText: "Scheduling task..." },
  "task-list": { icon: "📋", label: "List Tasks", runText: "Listing tasks..." },
  "task-cancel": { icon: "❌", label: "Cancel Task", runText: "Cancelling task..." },
  // Delegation
  "delegate-browser-agent": { icon: "🌐", label: "Browser Agent", runText: "Delegating to Browser Agent..." },
  "delegate-file-agent": { icon: "📁", label: "File Agent", runText: "Delegating to File Agent..." },
  "delegate-coder-agent": { icon: "💻", label: "Coder Agent", runText: "Delegating to Coder Agent..." },
  "delegate-researcher-agent": { icon: "🔍", label: "Researcher", runText: "Delegating to Researcher..." },
  "delegate-data-analyst-agent": { icon: "📊", label: "Data Analyst", runText: "Delegating to Data Analyst..." },
  // Planning
  "create-plan": { icon: "📋", label: "Create Plan", runText: "Planning approach..." },
  "execute-plan-step": { icon: "▶️", label: "Execute Step", runText: "Executing step..." },
  "review-output": { icon: "🔍", label: "Self-Review", runText: "Reviewing output quality..." },
  "get-plan-status": { icon: "📊", label: "Plan Status", runText: "Checking plan..." },
  // Recovery
  "suggest-recovery": { icon: "🔄", label: "Find Alternative", runText: "Finding alternative approach..." },
  "log-recovery": { icon: "✅", label: "Recovery Logged", runText: "Logging recovery..." },
  // Confidence
  "confidence-check": { icon: "🎯", label: "Confidence Check", runText: "Assessing confidence..." },
  // Agent Communication
  "pass-context": { icon: "📤", label: "Pass Context", runText: "Passing data to agent..." },
  "agent-handoff": { icon: "🔗", label: "Agent Handoff", runText: "Chaining agents..." },
  "code-review": { icon: "🔍", label: "Code Review", runText: "Reviewing code..." },
};

const DEFAULT_META = { icon: "🔧", label: "Tool", runText: "Working..." };

export default function ToolCard({ toolName, status, args, result }: ToolCardProps) {
  const [open, setOpen] = useState(false);
  const meta = TOOL_META[toolName] || DEFAULT_META;

  const hasContent = (args && Object.keys(args).length > 0) || result;

  return (
    <div className={`rounded-lg overflow-hidden my-1.5 border ${
      status === "running"
        ? "border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50"
        : "border-gray-200 bg-gray-50"
    }`}>
      <button
        onClick={() => hasContent && setOpen(!open)}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
          hasContent ? "hover:bg-black/[0.02] cursor-pointer" : "cursor-default"
        }`}
      >
        {/* Status icon */}
        {status === "running" ? (
          <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        )}

        {/* Label */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-sm">{meta.icon}</span>
          <span className="text-[13px] text-gray-700">
            {status === "running" ? (
              <span className="text-amber-700 font-medium">{meta.runText}</span>
            ) : (
              <>
                <span className="font-medium text-gray-800">{meta.label}</span>
                {args && Object.keys(args).length > 0 && (
                  <span className="text-gray-400 ml-1.5 text-xs">
                    {Object.values(args).filter(v => typeof v === "string").map(v => `"${(v as string).slice(0, 30)}"`).join(", ")}
                  </span>
                )}
              </>
            )}
          </span>
        </div>

        {/* Expand */}
        {hasContent && (
          <span className={`text-gray-300 text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        )}
      </button>

      {/* Expanded */}
      {open && hasContent && (
        <div className="px-3.5 pb-3 space-y-2 border-t border-gray-200/60">
          {args && Object.keys(args).length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] font-semibold text-blue-500 uppercase mb-1">Input</div>
              <pre className="text-[11px] text-gray-600 bg-white rounded-md p-2.5 overflow-x-auto max-h-28 font-mono border border-gray-100 leading-relaxed">
                {typeof args === "string" ? args : JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <div className="text-[10px] font-semibold text-green-600 uppercase mb-1">Output</div>
              <pre className="text-[11px] text-gray-600 bg-white rounded-md p-2.5 overflow-x-auto max-h-48 font-mono border border-gray-100 leading-relaxed">
                {typeof result === "string" ? result.slice(0, 3000) : JSON.stringify(result, null, 2).slice(0, 3000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
