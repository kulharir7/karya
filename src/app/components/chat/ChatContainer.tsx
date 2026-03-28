"use client";

import { useRef, useEffect, useState } from "react";
import type { ChatMessage as ChatMessageType, ToolCall, AgentInfo } from "@/app/hooks/useChat";
import ChatMessage from "./ChatMessage";
import ToolChips from "./ToolChip";
import MessageContent from "@/app/components/MessageContent";
import ThinkingIndicator from "./ThinkingIndicator";
import WelcomeScreen from "./WelcomeScreen";

interface ChatContainerProps {
  messages: ChatMessageType[];
  streamingText: string;
  streamingTools: ToolCall[];
  isLoading: boolean;
  activeAgent: AgentInfo | null;
  onQuickSend: (text: string) => void;
}

export default function ChatContainer({
  messages, streamingText, streamingTools, isLoading, activeAgent, onQuickSend,
}: ChatContainerProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScroll, setShowScroll] = useState(false);

  // Auto-scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingText, streamingTools]);

  // Scroll button
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => setShowScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const isEmpty = messages.length === 0 && !streamingText;
  const isStreaming = streamingTools.length > 0 || streamingText || (isLoading && !streamingText && streamingTools.length === 0);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto bg-[var(--bg-primary)] relative">
      {isEmpty ? (
        <WelcomeScreen onSend={onQuickSend} />
      ) : (
        <div className="max-w-3xl mx-auto px-5 py-5 space-y-1">
          {/* Saved messages */}
          {messages.map((msg, idx) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onRetry={msg.role === "assistant" && idx > 0 ? () => onQuickSend(messages[idx - 1]?.content || "") : undefined}
            />
          ))}

          {/* Currently streaming message */}
          {isStreaming && (
            <div className="py-3 px-1">
              {/* Header */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-[10px] text-white shrink-0">⚡</div>
                <span className="text-[12px] font-medium text-[var(--text-primary)]">Karya</span>
                {activeAgent && activeAgent.agent !== "supervisor" && (
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-medium border border-purple-500/20">
                    {({ browser: "🌐 Browser", file: "📁 File", coder: "💻 Coder", researcher: "🔍 Research", "data-analyst": "📊 Data" } as Record<string, string>)[activeAgent.agent] || activeAgent.agent}
                  </span>
                )}
                {streamingTools.length > 0 && (
                  <span className="text-[10px] text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-full font-medium">
                    ✦ {streamingTools.length} tool{streamingTools.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="pl-8">
                {/* Tool chips */}
                {streamingTools.length > 0 && <ToolChips tools={streamingTools} />}

                {/* Streaming text */}
                {streamingText && (
                  <div className="mt-1">
                    <MessageContent content={streamingText} />
                    <span className="inline-block w-0.5 h-4 bg-purple-500 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
                  </div>
                )}

                {/* Thinking indicator (no text yet, no tools yet) */}
                {isLoading && !streamingText && streamingTools.length === 0 && (
                  <ThinkingIndicator agent={activeAgent} currentTool={streamingTools[streamingTools.length - 1]?.toolName} />
                )}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Scroll to bottom */}
      {showScroll && (
        <div className="sticky bottom-4 flex justify-center z-10">
          <button onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] shadow-lg rounded-full px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
            ↓ Scroll to bottom
          </button>
        </div>
      )}
    </div>
  );
}
