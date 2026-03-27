"use client";

import { getRiskLevel, getRiskDisplay, requiresConfirmation, type RiskLevel } from "@/lib/tool-permissions";

interface ToolCardProps {
  toolName: string;
  status: "running" | "done" | "error";
  args?: any;
  result?: any;
  showRisk?: boolean;
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
  "system-screenshot": { icon: "📸", label: "Screen Capture", runText: "Capturing screen..." },
  "analyze-image": { icon: "👁️", label: "Analyze Image", runText: "Analyzing with vision AI..." },
  "code-write": { icon: "📝", label: "Write Code", runText: "Writing code..." },
  "code-execute": { icon: "▶️", label: "Execute Code", runText: "Running code..." },
  "code-analyze": { icon: "🔬", label: "Analyze Code", runText: "Analyzing code..." },
  "api-call": { icon: "🌐", label: "API Call", runText: "Calling API..." },
  "data-csv-parse": { icon: "📊", label: "Parse CSV", runText: "Parsing CSV..." },
  "data-json-query": { icon: "🔎", label: "Query JSON", runText: "Querying JSON..." },
  "data-transform": { icon: "🔄", label: "Transform Data", runText: "Transforming data..." },
  "memory-search": { icon: "🧠", label: "Search Memory", runText: "Searching memory..." },
  "memory-read": { icon: "📖", label: "Read Memory", runText: "Reading memory..." },
  "memory-write": { icon: "✏️", label: "Write Memory", runText: "Saving to memory..." },
  "memory-log": { icon: "📝", label: "Log Activity", runText: "Logging activity..." },
  "memory-list": { icon: "📋", label: "List Memory", runText: "Listing memory files..." },
  "memory-recall": { icon: "🔮", label: "Semantic Recall", runText: "Searching with AI..." },
  "task-schedule": { icon: "⏰", label: "Schedule Task", runText: "Scheduling task..." },
  "task-list": { icon: "📋", label: "List Tasks", runText: "Listing tasks..." },
  "task-cancel": { icon: "❌", label: "Cancel Task", runText: "Cancelling task..." },
  "delegate-browser-agent": { icon: "🌐", label: "Browser Agent", runText: "Delegating to Browser Agent..." },
  "delegate-file-agent": { icon: "📁", label: "File Agent", runText: "Delegating to File Agent..." },
  "delegate-coder-agent": { icon: "💻", label: "Coder Agent", runText: "Delegating to Coder Agent..." },
  "delegate-researcher-agent": { icon: "🔍", label: "Researcher", runText: "Delegating to Researcher..." },
  "delegate-data-analyst-agent": { icon: "📊", label: "Data Analyst", runText: "Delegating to Data Analyst..." },
  "create-plan": { icon: "📋", label: "Create Plan", runText: "Planning approach..." },
  "execute-plan-step": { icon: "▶️", label: "Execute Step", runText: "Executing step..." },
  "review-output": { icon: "🔍", label: "Self-Review", runText: "Reviewing output quality..." },
  "get-plan-status": { icon: "📊", label: "Plan Status", runText: "Checking plan..." },
  "suggest-recovery": { icon: "🔄", label: "Find Alternative", runText: "Finding alternative approach..." },
  "log-recovery": { icon: "✅", label: "Recovery Logged", runText: "Logging recovery..." },
  "confidence-check": { icon: "🎯", label: "Confidence Check", runText: "Assessing confidence..." },
  "pass-context": { icon: "📤", label: "Pass Context", runText: "Passing data to agent..." },
  "agent-handoff": { icon: "🔗", label: "Agent Handoff", runText: "Chaining agents..." },
  "code-review": { icon: "🔍", label: "Code Review", runText: "Reviewing code..." },
  "git-status": { icon: "🔀", label: "Git Status", runText: "Checking git status..." },
  "git-commit": { icon: "💾", label: "Git Commit", runText: "Committing changes..." },
  "git-push": { icon: "🚀", label: "Git Push", runText: "Pushing to remote..." },
  "git-log": { icon: "📜", label: "Git Log", runText: "Loading commit history..." },
  "git-diff": { icon: "📝", label: "Git Diff", runText: "Checking changes..." },
  // Skills
  "skill-list": { icon: "📚", label: "List Skills", runText: "Listing skills..." },
  "skill-match": { icon: "🔍", label: "Match Skills", runText: "Finding matching skills..." },
  "skill-load": { icon: "📖", label: "Load Skill", runText: "Loading skill instructions..." },
  "skill-create": { icon: "✨", label: "Create Skill", runText: "Creating new skill..." },
};

const DEFAULT_META = { icon: "🔧", label: "Tool", runText: "Working..." };

// Tools that should completely hide their output (internal use only)
const HIDE_OUTPUT_TOOLS = new Set([
  "memory-search",        // internal search results
  "memory-read",          // agent uses it, user doesn't need raw
  "pass-context",         // internal agent data
  "confidence-check",     // internal confidence score
  "suggest-recovery",     // internal recovery suggestions
  "log-recovery",         // internal logging
  "skill-load",           // skill instructions are internal
  "skill-match",          // internal matching results
]);

// Tools that show minimal output (just success/fail + key info)
const MINIMAL_OUTPUT_TOOLS: Record<string, (result: any) => string> = {
  "system-screenshot": (r) => r?.success ? `📸 Screen captured (${r.width}×${r.height})` : "❌ Screenshot failed",
  "browser-screenshot": (r) => r?.success ? `📸 Page captured` : "❌ Screenshot failed",
  "file-write": (r) => r?.success ? `✅ File saved: ${r.path || r.filePath || 'file'}` : "❌ Write failed",
  "code-write": (r) => r?.success ? `✅ Code saved: ${r.path || r.filePath || 'file'}` : "❌ Write failed",
  "memory-write": (r) => r?.success ? `✅ Saved to memory` : "❌ Memory write failed",
  "memory-log": (r) => r?.success ? `✅ Logged to daily memory` : "❌ Log failed",
  "memory-list": (r) => r?.files ? `📋 ${r.files.length} memory files` : "📋 Memory files listed",
  "clipboard-write": (r) => r?.success ? `✅ Copied to clipboard` : "❌ Clipboard write failed",
  "system-notify": (r) => r?.success ? `🔔 Notification sent` : "❌ Notification failed",
  "git-commit": (r) => r?.success ? `✅ Committed: ${r.commitHash?.slice(0, 7) || 'done'}` : "❌ Commit failed",
  "git-push": (r) => r?.success ? `✅ Pushed to remote` : "❌ Push failed",
  "task-schedule": (r) => r?.success ? `⏰ Task scheduled: ${r.taskId || 'done'}` : "❌ Schedule failed",
  "task-cancel": (r) => r?.success ? `✅ Task cancelled` : "❌ Cancel failed",
  // Skills
  "skill-list": (r) => `📚 ${r?.count || r?.skills?.length || 0} skills available`,
  "skill-create": (r) => r?.success ? `✨ Skill created: ${r.skillName}` : "❌ Skill creation failed",
  // Web/Browser
  "web-search": (r) => r?.results?.length ? `🔍 Found ${r.results.length} results` : "🔍 Search completed",
  "browser-navigate": (r) => r?.success ? `🌐 Opened: ${r.url?.slice(0, 50)}...` : "❌ Navigation failed",
  "browser-extract": (r) => r?.success ? `📊 Data extracted` : "❌ Extraction failed",
};

/**
 * Format tool output for display — clean key-value pairs
 */
function formatOutput(result: any): { type: 'text' | 'table' | 'minimal'; content: string | Array<{key: string; value: string}> } {
  // If it's already a string, try to parse as JSON
  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return { type: 'table', content: objectToKeyValue(parsed) };
      }
      return { type: 'text', content: JSON.stringify(parsed, null, 2) };
    } catch {
      return { type: 'text', content: result.slice(0, 2000) };
    }
  }
  
  // If it's an object, convert to key-value
  if (typeof result === "object" && result !== null && !Array.isArray(result)) {
    return { type: 'table', content: objectToKeyValue(result) };
  }
  
  return { type: 'text', content: String(result).slice(0, 2000) };
}

function objectToKeyValue(obj: Record<string, any>): Array<{key: string; value: string}> {
  return Object.entries(obj).map(([key, value]) => {
    // Format key: camelCase → Title Case
    const displayKey = key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/^./, s => s.toUpperCase())
      .trim();
    
    // Format value
    let displayValue: string;
    if (typeof value === "object" && value !== null) {
      displayValue = JSON.stringify(value);
    } else if (typeof value === "number") {
      if (key.toLowerCase().includes("memory") && value < 100) {
        displayValue = `${value.toFixed(1)} GB`;
      } else {
        displayValue = value.toLocaleString();
      }
    } else if (typeof value === "boolean") {
      displayValue = value ? "Yes" : "No";
    } else {
      displayValue = String(value);
    }
    
    return { key: displayKey, value: displayValue };
  });
}

// Risk badge component
function RiskBadge({ risk }: { risk: RiskLevel }) {
  const display = getRiskDisplay(risk);
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: display.bgColor, color: display.color }}
      title={display.description}
    >
      {display.emoji} {display.label}
    </span>
  );
}

export default function ToolCard({ toolName, status, args, result, showRisk = true }: ToolCardProps) {
  const meta = TOOL_META[toolName] || DEFAULT_META;
  const riskLevel = getRiskLevel(toolName);
  const isDangerous = requiresConfirmation(toolName);
  const isRunning = status === "running";
  const hasResult = result !== undefined && result !== null;
  
  // Check if this tool should hide or minimize output
  const shouldHideOutput = HIDE_OUTPUT_TOOLS.has(toolName);
  const minimalFormatter = MINIMAL_OUTPUT_TOOLS[toolName];
  
  // Format output based on tool type
  let output: { type: 'text' | 'table' | 'minimal'; content: string | Array<{key: string; value: string}> } | null = null;
  if (hasResult) {
    if (shouldHideOutput) {
      output = null; // Completely hide
    } else if (minimalFormatter) {
      output = { type: 'minimal', content: minimalFormatter(result) };
    } else {
      output = formatOutput(result);
    }
  }

  return (
    <div className={`rounded-xl overflow-hidden my-2 border ${
      isDangerous && isRunning
        ? "border-red-300 bg-gradient-to-r from-red-50 to-orange-50"
        : isRunning
        ? "border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50"
        : isDangerous
        ? "border-red-200 bg-white"
        : "border-gray-200 bg-white"
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        {/* Status icon */}
        {isRunning ? (
          <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}

        {/* Tool name */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-base">{meta.icon}</span>
          <span className="text-sm font-medium text-gray-800">
            {isRunning ? (
              <span className="text-amber-700">{meta.runText}</span>
            ) : (
              meta.label
            )}
          </span>
        </div>

        {/* Risk Badge */}
        {showRisk && <RiskBadge risk={riskLevel} />}
      </div>

      {/* Dangerous tool warning banner */}
      {isDangerous && isRunning && (
        <div className="px-4 py-2 bg-red-100 border-t border-red-200 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span className="text-xs font-medium text-red-700">
            ⚠️ Dangerous operation in progress — this action may modify your system
          </span>
        </div>
      )}

      {/* Dangerous tool executed notice */}
      {isDangerous && !isRunning && hasResult && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="text-xs text-red-600">
            This was a dangerous operation. Review the output carefully.
          </span>
        </div>
      )}

      {/* Output — always visible when done */}
      {hasResult && output && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          {output.type === 'minimal' ? (
            // Minimal output — single line status
            <div className="px-4 py-2.5">
              <span className="text-sm text-gray-700">{output.content as string}</span>
            </div>
          ) : output.type === 'table' ? (
            <div className="px-4 py-3">
              <div className="space-y-1.5">
                {(output.content as Array<{key: string; value: string}>).map(({ key, value }, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="text-gray-500 min-w-[120px] shrink-0">{key}</span>
                    <span className="text-gray-800 font-medium break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <pre className="px-4 py-3 text-xs text-gray-700 font-mono overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
              {output.content as string}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
