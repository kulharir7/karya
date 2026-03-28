"use client";

import { useState } from "react";

interface ApprovalDialogProps {
  toolName: string;
  args: any;
  toolCallId: string;
  onApprove: () => void;
  onDecline: () => void;
}

const TOOL_LABELS: Record<string, { icon: string; warning: string }> = {
  "shell-execute": { icon: "💻", warning: "This will execute a shell command on your computer." },
  "code-execute": { icon: "▶️", warning: "This will run code on your machine." },
  "system-kill-process": { icon: "⛔", warning: "This will terminate a running process." },
  "git-push": { icon: "🚀", warning: "This will push code to a remote repository." },
  "plugin-uninstall": { icon: "🗑️", warning: "This will permanently remove a plugin from disk." },
};

export default function ApprovalDialog({
  toolName, args, toolCallId, onApprove, onDecline,
}: ApprovalDialogProps) {
  const [deciding, setDeciding] = useState(false);
  const meta = TOOL_LABELS[toolName] || { icon: "⚠️", warning: "This tool requires your approval before running." };

  // Format args for display
  const argEntries = args ? Object.entries(args).slice(0, 5) : [];

  return (
    <div className="my-3 rounded-xl border-2 border-amber-400 bg-amber-500/5 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-400/30">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-lg">
          {meta.icon}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-amber-700">
            ⚠️ Approval Required
          </div>
          <div className="text-xs text-amber-600">
            {meta.warning}
          </div>
        </div>
      </div>

      {/* Tool details */}
      <div className="px-4 py-3">
        <div className="text-xs text-[var(--text-muted)] mb-2 font-medium uppercase tracking-wider">
          Tool: {toolName}
        </div>

        {argEntries.length > 0 && (
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 mb-3">
            {argEntries.map(([key, value]) => (
              <div key={key} className="flex gap-2 text-xs mb-1 last:mb-0">
                <span className="text-[var(--text-muted)] shrink-0 font-medium">{key}:</span>
                <span className="text-[var(--text-primary)] font-mono break-all">
                  {String(value).slice(0, 200)}{String(value).length > 200 ? "..." : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setDeciding(true); onApprove(); }}
            disabled={deciding}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 shadow-sm"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => { setDeciding(true); onDecline(); }}
            disabled={deciding}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 shadow-sm"
          >
            ✕ Decline
          </button>
          <span className="text-[10px] text-[var(--text-muted)]">
            {deciding ? "Processing..." : "Tool is paused until you decide"}
          </span>
        </div>
      </div>
    </div>
  );
}
