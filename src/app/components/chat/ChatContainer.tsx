"use client";

import { useRef, useEffect, useState } from "react";
import type { ChatMessage, ToolCall, AgentInfo } from "@/app/hooks/useChat";
import ToolCard from "@/app/components/ToolCard";
import MessageContent from "@/app/components/MessageContent";
import ThinkingIndicator from "./ThinkingIndicator";
import WelcomeScreen from "./WelcomeScreen";

interface ChatContainerProps {
  messages: ChatMessage[];
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
        <div className="max-w-3xl mx-auto px-5 py-5 space-y-4">
          {/* Saved messages */}
          {messages.map((msg, idx) => (
            <div key={msg.id} className="group/msg">
              {msg.role === "user" && (
                <div className="py-3 px-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">R</div>
                    <span className="text-[12px] font-medium text-[var(--text-primary)]">You</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="pl-8">
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.images.map((img, i) => (
                          <img key={i} src={img} alt={`Attached ${i + 1}`} className="max-w-[200px] max-h-[150px] rounded-lg border border-gray-200 object-cover" />
                        ))}
                      </div>
                    )}
                    <p className="text-[13.5px] text-[var(--text-primary)] leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              )}
              {msg.role === "assistant" && (
                <div className="py-3 px-1 rounded-xl hover:bg-[var(--bg-hover)] transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-[10px] text-white shrink-0">⚡</div>
                    <span className="text-[12px] font-medium text-[var(--text-primary)]">Karya</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <span className="text-[10px] text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-full font-medium">
                        ✦ {msg.toolCalls.length} tool{msg.toolCalls.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="pl-8">
                    {msg.toolCalls?.map((t, i) => (
                      <ToolCard key={i} toolName={t.toolName} status={t.status === "done" ? "done" : "error"} args={t.args} result={t.result} />
                    ))}
                    {msg.content && <div className="mt-1"><MessageContent content={msg.content} /></div>}
                    {/* Actions */}
                    <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5 mt-2 -ml-1">
                      <button onClick={() => navigator.clipboard.writeText(msg.content)}
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md hover:bg-[var(--bg-secondary)] transition-all">📋 Copy</button>
                      <button onClick={() => { const prev = messages[idx - 1]; if (prev) onQuickSend(prev.content); }}
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md hover:bg-[var(--bg-secondary)] transition-all">🔄 Retry</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <div className="py-3 px-1">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-[10px] text-white shrink-0">⚡</div>
                <span className="text-[12px] font-medium text-[var(--text-primary)]">Karya</span>
                {streamingTools.length > 0 && (
                  <span className="text-[10px] text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-full font-medium">
                    ✦ {streamingTools.length} tool{streamingTools.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="pl-8">
                {streamingTools.map((t, i) => (
                  <ToolCard key={i} toolName={t.toolName} status={t.status} args={t.args} result={t.result} />
                ))}
                {streamingText && (
                  <div className="mt-1">
                    <MessageContent content={streamingText} />
                    <span className="inline-block w-0.5 h-4 bg-purple-500 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
                  </div>
                )}
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
