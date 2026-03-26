"use client";

import { useState, useEffect, useRef } from "react";

interface Command {
  id: string;
  icon: string;
  label: string;
  category: string;
  action: string;
}

const COMMANDS: Command[] = [
  { id: "sys", icon: "💻", label: "System info batao", category: "System", action: "System info batao" },
  { id: "files", icon: "📁", label: "Desktop pe files dikhao", category: "Files", action: "Desktop pe kya files hain?" },
  { id: "search", icon: "🔍", label: "Web search...", category: "Browser", action: "Search " },
  { id: "clip", icon: "📋", label: "Clipboard contents", category: "System", action: "Clipboard mein kya hai?" },
  { id: "pdf", icon: "📄", label: "Find PDFs in Downloads", category: "Files", action: "Downloads mein sab PDF files dhundho" },
  { id: "create", icon: "📝", label: "Create a file...", category: "Files", action: "Desktop pe ek file banao " },
  { id: "size", icon: "📏", label: "Folder size check", category: "Files", action: "F:\\karya folder ka size batao" },
  { id: "zip", icon: "🗜️", label: "Zip a folder", category: "Files", action: "Desktop folder ka zip banao" },
  { id: "resize", icon: "🖼️", label: "Resize an image", category: "Files", action: "Is image ko 500px wide resize karo: " },
  { id: "cmd", icon: "⚡", label: "Run a command...", category: "Shell", action: "" },
  { id: "nav", icon: "🌐", label: "Open a website...", category: "Browser", action: "Browser mein kholo: " },
  { id: "notify", icon: "🔔", label: "Send notification", category: "System", action: "Desktop notification bhejo: Hello from Karya!" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (action: string) => void;
}

export default function CommandPalette({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
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
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  const categories = [...new Set(filtered.map((c) => c.category))];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <span className="text-gray-400 text-sm">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) {
                onSelect(filtered[0].action);
                onClose();
              }
            }}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
          />
          <kbd className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-2">
          {categories.map((cat) => (
            <div key={cat}>
              <div className="px-4 py-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{cat}</span>
              </div>
              {filtered
                .filter((c) => c.category === cat)
                .map((cmd) => (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      onSelect(cmd.action);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-purple-50 text-left transition-colors"
                  >
                    <span className="text-sm">{cmd.icon}</span>
                    <span className="text-sm text-gray-700">{cmd.label}</span>
                  </button>
                ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No commands found</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-400">
          <span><kbd className="bg-gray-100 px-1 py-0.5 rounded">↵</kbd> Select</span>
          <span><kbd className="bg-gray-100 px-1 py-0.5 rounded">ESC</kbd> Close</span>
          <span><kbd className="bg-gray-100 px-1 py-0.5 rounded">Ctrl+K</kbd> Toggle</span>
        </div>
      </div>
    </div>
  );
}
