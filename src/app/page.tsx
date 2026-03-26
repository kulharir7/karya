"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { saveHistory, loadHistory, clearHistory } from "@/lib/storage";
import ToolCard from "./components/ToolCard";
import MessageContent from "./components/MessageContent";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: { toolName: string; args?: any; result?: any; status: string }[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingTools, setStreamingTools] = useState<
    { toolName: string; args?: any; result?: any; status: "running" | "done" }[]
  >([]);
  const [taskCount, setTaskCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadHistory();
    if (saved.length > 0) setMessages(saved);
  }, []);

  useEffect(() => {
    if (messages.length > 0) saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, streamingTools]);

  const handleClear = () => {
    setMessages([]);
    setTaskCount(0);
    clearHistory();
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      const currentInput = input.trim();
      setInput("");
      setIsLoading(true);
      setStreamingText("");
      setStreamingTools([]);
      setTaskCount((c) => c + 1);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: currentInput,
            history: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!res.ok) throw new Error("Server error");

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";
        const tools: { toolName: string; args?: any; result?: any; status: "running" | "done" }[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6).trim());

              if (data.type === "text") {
                fullText += data.content;
                setStreamingText(fullText);
              } else if (data.type === "tool-call") {
                tools.push({
                  toolName: data.toolName,
                  args: data.args,
                  status: "running",
                });
                setStreamingTools([...tools]);
              } else if (data.type === "tool-result") {
                const idx = tools.findIndex(
                  (t) => t.toolName === data.toolName && t.status === "running"
                );
                if (idx !== -1) {
                  tools[idx].result = data.result;
                  tools[idx].status = "done";
                  setStreamingTools([...tools]);
                }
              } else if (data.type === "error") {
                fullText += `\n❌ ${data.content}`;
                setStreamingText(fullText);
              }
            } catch {}
          }
        }

        // Finalize
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: fullText || "✅ Task completed.",
          timestamp: Date.now(),
          toolCalls: tools.map((t) => ({ ...t, status: t.status })),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingText("");
        setStreamingTools([]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `❌ Error: ${err.message}`,
            timestamp: Date.now(),
          },
        ]);
        setStreamingText("");
        setStreamingTools([]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/20">
          ⚡
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-white">Karya</h1>
          <p className="text-[10px] text-[var(--text-secondary)]">
            AI Computer Agent • {taskCount} tasks executed
          </p>
        </div>
        <Link
          href="/settings"
          className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors text-sm"
          title="Settings"
        >
          ⚙️
        </Link>
        <button
          onClick={handleClear}
          className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors text-sm"
          title="Clear chat"
        >
          🗑️
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !streamingText ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-3xl mb-5 shadow-lg shadow-purple-500/20">
              ⚡
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Karya</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-md">
              I don&apos;t talk — I DO. Browser, files, commands, automation.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-xl w-full">
              {[
                { icon: "💻", text: "System info batao" },
                { icon: "📁", text: "Desktop pe kya files hain?" },
                { icon: "🔍", text: "Search 'Mastra AI framework'" },
                { icon: "📋", text: "Clipboard mein kya hai?" },
                { icon: "📄", text: "Find all PDFs in Downloads" },
                { icon: "📝", text: "Create test.txt on Desktop" },
              ].map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setInput(ex.text)}
                  className="text-left text-xs p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-purple-500/30 transition-all text-[var(--text-secondary)] flex items-start gap-2"
                >
                  <span className="text-base">{ex.icon}</span>
                  <span className="leading-tight">{ex.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id}>
                {/* User message */}
                {msg.role === "user" && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-purple-600 text-white rounded-2xl rounded-br-md px-4 py-2.5">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                )}

                {/* Assistant message */}
                {msg.role === "assistant" && (
                  <div className="flex justify-start">
                    <div className="max-w-[90%] space-y-1">
                      {/* Tool calls */}
                      {msg.toolCalls &&
                        msg.toolCalls.map((tool, i) => (
                          <ToolCard
                            key={i}
                            toolName={tool.toolName}
                            status={tool.status === "done" ? "done" : "error"}
                            args={tool.args}
                            result={tool.result}
                          />
                        ))}

                      {/* Text content */}
                      {msg.content && (
                        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3">
                          <MessageContent content={msg.content} />
                          <p className="text-[10px] mt-2 text-[var(--text-secondary)] opacity-50">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Streaming tool cards */}
            {streamingTools.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[90%] space-y-1">
                  {streamingTools.map((tool, i) => (
                    <ToolCard
                      key={i}
                      toolName={tool.toolName}
                      status={tool.status}
                      args={tool.args}
                      result={tool.result}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Streaming text */}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[90%] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3">
                  <MessageContent content={streamingText} />
                  <span className="inline-block w-1.5 h-4 bg-purple-400 animate-pulse rounded-sm ml-0.5 align-text-bottom"></span>
                </div>
              </div>
            )}

            {/* Loading */}
            {isLoading && !streamingText && streamingTools.length === 0 && (
              <div className="flex justify-start">
                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl px-4 py-3 flex items-center gap-3">
                  <div className="flex gap-1 animate-thinking">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  </div>
                  <span className="text-sm text-[var(--text-secondary)]">
                    Karya is thinking...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--border)] p-4 bg-[var(--bg-secondary)]">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bolo kya karna hai..."
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 resize-none disabled:opacity-50"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="h-12 px-5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium text-sm hover:from-purple-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20 active:scale-95"
          >
            {isLoading ? "⏳" : "⚡"}
          </button>
        </form>
      </div>
    </div>
  );
}
