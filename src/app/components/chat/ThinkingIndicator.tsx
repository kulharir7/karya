"use client";

import { useState, useEffect } from "react";
import type { AgentInfo } from "@/app/hooks/useChat";

const AGENT_EMOJI: Record<string, string> = {
  browser: "🌐", file: "📁", coder: "💻", researcher: "🔍", "data-analyst": "📊", supervisor: "⚡",
};

const AGENT_LABEL: Record<string, string> = {
  browser: "Browser Agent", file: "File Agent", coder: "Coder Agent",
  researcher: "Research Agent", "data-analyst": "Data Analyst", supervisor: "Karya",
};

export default function ThinkingIndicator({ agent, currentTool }: {
  agent: AgentInfo | null;
  currentTool?: string;
}) {
  const [phase, setPhase] = useState(0);
  const [dots, setDots] = useState(1);

  const phases = agent?.reason
    ? [agent.reason]
    : currentTool
    ? [`Using ${currentTool}`]
    : ["Analyzing request", "Thinking", "Planning approach", "Preparing response"];

  useEffect(() => {
    const p = setInterval(() => setPhase((v) => (v + 1) % phases.length), 3000);
    const d = setInterval(() => setDots((v) => (v % 3) + 1), 500);
    return () => { clearInterval(p); clearInterval(d); };
  }, [phases.length]);

  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)] animate-fade-in">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-full border-2 border-[var(--accent)]/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)] animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-sm">
          {agent ? AGENT_EMOJI[agent.agent] || "⚡" : "🧠"}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {agent ? AGENT_LABEL[agent.agent] || "Processing" : "Karya"}
          </span>
        </div>
        <div className="text-xs text-[var(--text-muted)] truncate">
          {phases[phase]}{".".repeat(dots)}
        </div>
      </div>
      {currentTool && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--accent)] bg-[var(--accent-light)] px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          {currentTool}
        </div>
      )}
    </div>
  );
}
