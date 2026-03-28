"use client";

import type { ChatMessage as ChatMessageType } from "@/app/hooks/useChat";
import MessageContent from "@/app/components/MessageContent";
import ToolChips from "./ToolChip";

interface ChatMessageProps {
  message: ChatMessageType;
  onRetry?: (text: string) => void;
}

export default function ChatMessage({ message: msg, onRetry }: ChatMessageProps) {
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (msg.role === "user") {
    return (
      <div className="py-3 px-1">
        {/* User header */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">R</div>
          <span className="text-[12px] font-medium text-[var(--text-primary)]">You</span>
          <span className="text-[10px] text-[var(--text-muted)]">{time}</span>
        </div>

        {/* Content */}
        <div className="pl-8">
          {/* Attached images */}
          {msg.images && msg.images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {msg.images.map((img, i) => (
                <img key={i} src={img} alt={`Attached ${i + 1}`} className="max-w-[200px] max-h-[150px] rounded-lg border border-[var(--border)] object-cover" />
              ))}
            </div>
          )}
          <p className="text-[13.5px] text-[var(--text-primary)] leading-relaxed">{msg.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  const toolCount = msg.toolCalls?.length || 0;

  return (
    <div className="group/msg py-3 px-1 rounded-xl hover:bg-[var(--bg-hover)] transition-colors">
      {/* Assistant header */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-[10px] text-white shrink-0">⚡</div>
        <span className="text-[12px] font-medium text-[var(--text-primary)]">Karya</span>
        <span className="text-[10px] text-[var(--text-muted)]">{time}</span>
        {toolCount > 0 && (
          <span className="text-[10px] text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-full font-medium">
            ✦ {toolCount} tool{toolCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="pl-8">
        {/* Tool chips (inline, compact) */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <ToolChips tools={msg.toolCalls} />
        )}

        {/* Text response */}
        {msg.content && (
          <div className="mt-1">
            <MessageContent content={msg.content} />
          </div>
        )}

        {/* Metadata line */}
        <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-2 mt-2 -ml-1">
          <button
            onClick={() => navigator.clipboard.writeText(msg.content)}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md hover:bg-[var(--bg-secondary)] transition-all"
          >
            📋 Copy
          </button>
          {onRetry && (
            <button
              onClick={() => onRetry(msg.content)}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md hover:bg-[var(--bg-secondary)] transition-all"
            >
              🔄 Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
