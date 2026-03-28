"use client";

import { useState, useEffect } from "react";

// ============================================
// EXAMPLE CATEGORIES
// ============================================

const CATEGORIES = [
  {
    label: "Code",
    color: "from-blue-500 to-cyan-500",
    examples: [
      { icon: "💻", text: "Create a todo app in HTML + JS", desc: "Full project" },
      { icon: "🐍", text: "Write a Python web scraper", desc: "BeautifulSoup" },
      { icon: "🔧", text: "Fix the bug in my code", desc: "Paste code" },
    ],
  },
  {
    label: "Browse",
    color: "from-green-500 to-emerald-500",
    examples: [
      { icon: "🔍", text: "Delhi ka mausam batao", desc: "Weather" },
      { icon: "🌐", text: "Search latest AI news", desc: "Web search" },
      { icon: "📰", text: "Summarize this URL", desc: "Extract content" },
    ],
  },
  {
    label: "Files",
    color: "from-orange-500 to-amber-500",
    examples: [
      { icon: "📁", text: "Organize my Downloads folder", desc: "Sort by type" },
      { icon: "📊", text: "Parse this CSV and find trends", desc: "Data analysis" },
      { icon: "🗜️", text: "ZIP all PDFs on Desktop", desc: "Archive" },
    ],
  },
  {
    label: "System",
    color: "from-purple-500 to-pink-500",
    examples: [
      { icon: "🖥️", text: "System info batao", desc: "OS, CPU, RAM" },
      { icon: "🔀", text: "Git status of all projects", desc: "Git" },
      { icon: "⏰", text: "Remind me in 30 minutes", desc: "Schedule task" },
    ],
  },
];

// ============================================
// GREETINGS
// ============================================

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Late night coding? 🌙";
  if (hour < 12) return "Good morning! ☀️";
  if (hour < 17) return "Good afternoon! 🌤️";
  if (hour < 21) return "Good evening! 🌆";
  return "Night owl mode! 🦉";
}

// ============================================
// COMPONENT
// ============================================

export default function WelcomeScreen({ onSend }: { onSend: (text: string) => void }) {
  const [activeTab, setActiveTab] = useState(0);
  const [greeting, setGreeting] = useState("");

  useEffect(() => { setGreeting(getGreeting()); }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      {/* Hero */}
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-4xl mb-6 shadow-2xl shadow-purple-500/30 animate-fade-in">
        ⚡
      </div>

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1 animate-fade-in">
        {greeting}
      </h1>
      <h2 className="text-lg text-[var(--text-secondary)] mb-2 animate-fade-in">
        I&apos;m <span className="font-semibold text-purple-500">Karya</span> — your AI Computer Agent.
      </h2>
      <p className="text-sm text-[var(--text-muted)] mb-8 text-center max-w-lg animate-fade-in">
        I don&apos;t just chat — I actually <span className="font-medium text-[var(--text-secondary)]">do things</span> on your computer.
        Browse the web, write code, manage files, run commands, and more.
      </p>

      {/* Category tabs */}
      <div className="flex gap-2 mb-4">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            onClick={() => setActiveTab(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === i
                ? "bg-purple-500/10 text-purple-500 border border-purple-500/30"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Examples grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl w-full">
        {CATEGORIES[activeTab].examples.map((ex, i) => (
          <button
            key={i}
            onClick={() => onSend(ex.text)}
            className="group text-left p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/5 transition-all active:scale-[0.98]"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl group-hover:scale-110 transition-transform mt-0.5">{ex.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">{ex.text}</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{ex.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-8 text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          82 tools
        </span>
        <span className="text-[var(--border)]">|</span>
        <span>6 agents</span>
        <span className="text-[var(--border)]">|</span>
        <span>9 workflows</span>
        <span className="text-[var(--border)]">|</span>
        <span>3 plugins</span>
      </div>

      {/* Shortcuts */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <kbd className="bg-[var(--bg-tertiary)] border border-[var(--border)] px-1.5 py-0.5 rounded font-mono">Ctrl+K</kbd>
          Commands
        </span>
        <span className="flex items-center gap-1">
          <kbd className="bg-[var(--bg-tertiary)] border border-[var(--border)] px-1.5 py-0.5 rounded font-mono">Ctrl+V</kbd>
          Paste images
        </span>
        <span className="flex items-center gap-1">
          <kbd className="bg-[var(--bg-tertiary)] border border-[var(--border)] px-1.5 py-0.5 rounded font-mono">Drop</kbd>
          Files
        </span>
      </div>
    </div>
  );
}
