"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ImageAttachment } from "@/app/hooks/useChat";
import { icons } from "@/app/components/sidebar/SidebarIcons";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const PLACEHOLDERS = [
  "Message Karya...",
  "Ask anything...",
  "What should I build?",
  "Search the web for...",
  "Organize my files...",
  "Run a command...",
];

interface ChatInputProps {
  isLoading: boolean;
  onSend: (text: string, images?: ImageAttachment[]) => void;
  onCancel: () => void;
}

export default function ChatInput({ isLoading, onSend, onCancel }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Rotate placeholder every 4s
  useEffect(() => {
    const timer = setInterval(() => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length), 4000);
    return () => clearInterval(timer);
  }, []);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "24px";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  useEffect(() => { autoResize(); }, [input, autoResize]);

  // Focus textarea on mount
  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Handle file drop + paste
  const processFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (IMAGE_TYPES.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          setPendingImages((prev) => [...prev, { base64, mimeType: file.type, name: file.name, preview: reader.result as string }]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Handle paste (images from clipboard)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      processFiles(imageFiles);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && pendingImages.length === 0) || isLoading) return;
    onSend(input, pendingImages.length > 0 ? pendingImages : undefined);
    setInput("");
    setPendingImages([]);
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "24px";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  const placeholder = pendingImages.length > 0
    ? "Describe what you want to know about this image..."
    : PLACEHOLDERS[placeholderIdx];

  return (
    <div
      className={`border-t bg-[var(--bg-secondary)] p-3 shrink-0 transition-colors ${
        dragging ? "border-purple-400 bg-purple-500/5" : "border-[var(--border)]"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files); }}
    >
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        {/* Drop zone overlay */}
        {dragging && (
          <div className="flex items-center justify-center gap-2 py-3 mb-2 rounded-lg border-2 border-dashed border-purple-400 bg-purple-500/5">
            <span className="text-xl">📎</span>
            <span className="text-xs font-medium text-purple-500">Drop images here</span>
          </div>
        )}

        {/* Image previews */}
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img.preview} alt={img.name} className="w-16 h-16 rounded-lg object-cover border border-[var(--border)]" />
                <button type="button" onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">×</button>
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center py-0.5 rounded-b-lg truncate px-1">{img.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="chat-input flex items-end gap-3 px-4 py-3">
          {/* Attach */}
          <label className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors shrink-0 pb-1" title="Attach files">
            <input ref={fileRef} type="file" className="hidden" multiple accept="image/*,.pdf,.txt,.json,.csv,.md,.py,.js,.ts,.html,.css" onChange={(e) => e.target.files && processFiles(e.target.files)} />
            {icons.attach}
          </label>

          {/* Textarea */}
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              rows={1}
              disabled={isLoading}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none disabled:opacity-50 leading-relaxed"
              style={{ minHeight: "24px", maxHeight: "160px" }}
            />
            {/* Bottom hints */}
            {input.length > 0 && !isLoading && (
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[9px] text-[var(--text-muted)]">
                  <kbd className="bg-[var(--bg-tertiary)] px-1 py-0.5 rounded text-[8px] border border-[var(--border)]">Enter</kbd> send
                  <span className="mx-1">·</span>
                  <kbd className="bg-[var(--bg-tertiary)] px-1 py-0.5 rounded text-[8px] border border-[var(--border)]">Shift+Enter</kbd> newline
                </span>
                {input.length > 200 && (
                  <span className="text-[9px] text-[var(--text-muted)]">{input.length} chars</span>
                )}
              </div>
            )}
          </div>

          {/* Cancel / Shortcut hint */}
          {isLoading ? (
            <button type="button" onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all font-medium shrink-0">
              <span>■</span> Stop
            </button>
          ) : (
            !input && pendingImages.length === 0 && (
              <div className="hidden md:flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] shrink-0 pb-1">
                <kbd className="bg-[var(--bg-tertiary)] border border-[var(--border)] px-1.5 py-0.5 rounded">⌘K</kbd>
              </div>
            )
          )}

          {/* Send button */}
          <button type="submit" disabled={isLoading || (!input.trim() && pendingImages.length === 0)}
            className="w-9 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center disabled:opacity-30 transition-all shrink-0 shadow-sm shadow-purple-500/20 active:scale-95"
            title="Send message">
            {isLoading ? <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : icons.send}
          </button>
        </div>
      </form>
    </div>
  );
}
