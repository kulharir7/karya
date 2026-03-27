"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface MemoryFile {
  name: string;
  path: string;
  size: number;
  modified: number;
}

export default function MemoryPage() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Load memory files
  useEffect(() => {
    fetch("/api/memory?action=list")
      .then((r) => r.json())
      .then((data) => {
        setFiles(data.files || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load file content
  const loadFile = async (path: string) => {
    setSelectedFile(path);
    try {
      const res = await fetch(`/api/memory?action=read&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setContent(data.content || "");
    } catch {
      setContent("Error loading file");
    }
  };

  // Search memory
  const searchMemory = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/memory?action=search&query=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Back</Link>
          <span className="text-[var(--text-muted)]">·</span>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">🧠 Memory</h1>
          <div className="flex-1" />
          <span className="text-xs text-[var(--text-muted)]">{files.length} files</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Sidebar - File List */}
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchMemory()}
                placeholder="Search memory..."
                className="w-full px-4 py-2.5 pl-10 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-purple-400"
              />
              <span className="absolute left-3 top-2.5 text-[var(--text-muted)]">🔍</span>
              {searching && (
                <div className="absolute right-3 top-3 w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">Search Results</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <div
                      key={i}
                      onClick={() => loadFile(r.path)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer"
                    >
                      <div className="text-xs font-medium text-[var(--text-primary)]">{r.path}</div>
                      <div className="text-[10px] text-[var(--text-muted)] line-clamp-2">{r.snippet}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File List */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[var(--border)]">
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Files</h3>
              </div>
              <div className="divide-y divide-[var(--border)] max-h-[400px] overflow-y-auto">
                {files.length > 0 ? (
                  files.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => loadFile(file.path)}
                      className={`px-4 py-3 cursor-pointer transition-colors ${
                        selectedFile === file.path
                          ? "bg-[var(--accent-light)]"
                          : "hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {file.name.endsWith(".md") ? "📝" : "📄"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{file.name}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {formatSize(file.size)} • {new Date(file.modified).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    No memory files yet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="md:col-span-2">
            {selectedFile ? (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">{selectedFile}</h3>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {content.split("\n").length} lines
                    </span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(content)}
                    className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    📋 Copy
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-[var(--text-primary)] overflow-auto max-h-[600px] whitespace-pre-wrap">
                  {content}
                </pre>
              </div>
            ) : (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl h-full flex items-center justify-center py-20">
                <div className="text-center">
                  <span className="text-4xl mb-3 block">🧠</span>
                  <p className="text-sm text-[var(--text-muted)]">Select a file to view its contents</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Memory stores conversations and learnings</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
