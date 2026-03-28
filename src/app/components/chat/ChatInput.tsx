"use client";

import { useState, useRef } from "react";
import type { ImageAttachment } from "@/app/hooks/useChat";
import { icons } from "@/app/components/sidebar/SidebarIcons";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

interface ChatInputProps {
  isLoading: boolean;
  onSend: (text: string, images?: ImageAttachment[]) => void;
  onCancel: () => void;
}

export default function ChatInput({ isLoading, onSend, onCancel }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && pendingImages.length === 0) || isLoading) return;
    onSend(input, pendingImages.length > 0 ? pendingImages : undefined);
    setInput("");
    setPendingImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] p-3 shrink-0">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        {/* Image previews */}
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img.preview} alt={img.name} className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
                <button type="button" onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">×</button>
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center py-0.5 rounded-b-lg truncate px-1">{img.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="chat-input flex items-end gap-3 px-4 py-3">
          {/* Attach */}
          <label className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors shrink-0 pb-1">
            <input ref={fileRef} type="file" className="hidden" multiple accept="image/*,.pdf,.txt,.json,.csv,.md" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            {icons.attach}
          </label>

          {/* Textarea */}
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={pendingImages.length > 0 ? "Describe the image..." : "Message Karya..."}
            rows={1} disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none disabled:opacity-50"
            style={{ minHeight: "24px", maxHeight: "120px" }} />

          {/* Hint / Cancel */}
          {isLoading ? (
            <button type="button" onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-all font-medium shrink-0">■ Stop</button>
          ) : (
            !input && (
              <div className="hidden md:flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] shrink-0 pb-1">
                <kbd className="bg-[var(--bg-tertiary)] border border-[var(--border)] px-1.5 py-0.5 rounded">⌘K</kbd>
              </div>
            )
          )}

          {/* Send */}
          <button type="submit" disabled={isLoading || (!input.trim() && pendingImages.length === 0)}
            className="w-9 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center disabled:opacity-30 transition-all shrink-0 shadow-sm shadow-purple-500/20">
            {isLoading ? <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : icons.send}
          </button>
        </div>
      </form>
    </div>
  );
}
