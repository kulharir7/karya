"use client";

import { useState, useEffect, useRef } from "react";

interface Command {
  id: string;
  icon: string;
  label: string;
  category: string;
  action: string;
  description?: string;
}

const COMMANDS: Command[] = [
  // System
  { id: "sys", icon: "💻", label: "System info", category: "System", action: "System info batao", description: "OS, CPU, RAM details" },
  { id: "time", icon: "🕐", label: "Date & Time", category: "System", action: "Aaj kya date aur time hai?", description: "Current date and time" },
  { id: "clip", icon: "📋", label: "Clipboard", category: "System", action: "Clipboard mein kya hai?", description: "Read clipboard contents" },
  { id: "notify", icon: "🔔", label: "Send notification", category: "System", action: "Desktop notification bhejo: Hello!", description: "Desktop notification" },
  { id: "screen", icon: "📸", label: "Screenshot", category: "System", action: "Screenshot lo", description: "Capture screen" },
  
  // Files
  { id: "files", icon: "📁", label: "List files", category: "Files", action: "Desktop pe kya files hain?", description: "Show Desktop files" },
  { id: "pdf", icon: "📄", label: "Find PDFs", category: "Files", action: "Downloads mein sab PDF files dhundho", description: "Search PDF files" },
  { id: "create", icon: "📝", label: "Create file", category: "Files", action: "Desktop pe ek file banao ", description: "Create a new file" },
  { id: "size", icon: "📏", label: "Folder size", category: "Files", action: "Is folder ka size batao: ", description: "Calculate size" },
  { id: "zip", icon: "🗜️", label: "Zip folder", category: "Files", action: "Is folder ka zip banao: ", description: "Create archive" },
  { id: "resize", icon: "🖼️", label: "Resize image", category: "Files", action: "Is image ko resize karo: ", description: "Resize/compress" },
  
  // Browser
  { id: "search", icon: "🔍", label: "Web search", category: "Browser", action: "Search ", description: "DuckDuckGo search" },
  { id: "nav", icon: "🌐", label: "Open website", category: "Browser", action: "Browser mein kholo: ", description: "Navigate to URL" },
  { id: "extract", icon: "📊", label: "Extract data", category: "Browser", action: "Is page se data extract karo: ", description: "Scrape webpage" },
  
  // Git
  { id: "git-status", icon: "🔀", label: "Git status", category: "Git", action: "Git status dikhao", description: "Check repo status" },
  { id: "git-commit", icon: "💾", label: "Git commit", category: "Git", action: "Changes commit karo: ", description: "Commit changes" },
  
  // Memory
  { id: "memory", icon: "🧠", label: "Search memory", category: "Memory", action: "Memory mein search karo: ", description: "Semantic search" },
  { id: "memory-log", icon: "📝", label: "Log to memory", category: "Memory", action: "Memory mein save karo: ", description: "Save to daily log" },
  
  // Workflows
  { id: "wf-list", icon: "⚡", label: "List workflows", category: "Workflows", action: "Sab workflows dikhao", description: "Show all 9 workflows" },
  { id: "wf-run", icon: "▶️", label: "Run workflow", category: "Workflows", action: "Workflow run karo: ", description: "Execute workflow" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (action: string) => void;
}

export default function CommandPalette({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!open) return null;

  const filtered = COMMANDS.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase()) ||
      c.description?.toLowerCase().includes(query.toLowerCase())
  );

  const categories = [...new Set(filtered.map((c) => c.category))];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      onSelect(filtered[selectedIndex].action);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
      
      {/* Modal */}
      <div
        className="relative w-full max-w-xl bg-[var(--bg-secondary)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <kbd className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-1 rounded-md border border-[var(--border)]">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {categories.length > 0 ? (
            categories.map((cat) => (
              <div key={cat}>
                <div className="px-5 py-1.5">
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{cat}</span>
                </div>
                {filtered
                  .filter((c) => c.category === cat)
                  .map((cmd) => {
                    const globalIndex = filtered.indexOf(cmd);
                    const isSelected = globalIndex === selectedIndex;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          onSelect(cmd.action);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                          isSelected 
                            ? "bg-[var(--accent-light)]" 
                            : "hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        <span className="text-lg w-6 text-center">{cmd.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)]">{cmd.label}</div>
                          {cmd.description && (
                            <div className="text-xs text-[var(--text-muted)] truncate">{cmd.description}</div>
                          )}
                        </div>
                        {isSelected && (
                          <kbd className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">↵</kbd>
                        )}
                      </button>
                    );
                  })}
              </div>
            ))
          ) : (
            <div className="text-center py-10">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm text-[var(--text-muted)]">No commands found</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-tertiary)] flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <kbd className="bg-[var(--bg-secondary)] border border-[var(--border)] px-1.5 py-0.5 rounded">↑</kbd>
            <kbd className="bg-[var(--bg-secondary)] border border-[var(--border)] px-1.5 py-0.5 rounded">↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-[var(--bg-secondary)] border border-[var(--border)] px-1.5 py-0.5 rounded">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-[var(--bg-secondary)] border border-[var(--border)] px-1.5 py-0.5 rounded">ESC</kbd>
            Close
          </span>
          <div className="flex-1" />
          <span className="text-[var(--accent)]">{filtered.length} commands</span>
        </div>
      </div>
    </div>
  );
}
