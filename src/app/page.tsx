"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ToolAction {
  tool: string;
  status: "running" | "done" | "error";
  input?: string;
  output?: string;
  timestamp: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [actions, setActions] = useState<ToolAction[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [taskCount, setTaskCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

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

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Server error");
        }

        const contentType = res.headers.get("content-type") || "";

        if (contentType.includes("text/event-stream")) {
          // SSE Streaming
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let fullText = "";
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const data = JSON.parse(jsonStr);

                if (data.type === "text") {
                  fullText += data.content;
                  setStreamingText(fullText);
                } else if (data.type === "tools") {
                  for (const tool of data.toolCalls) {
                    setActions((prev) => [
                      {
                        tool: tool.name,
                        status: "done",
                        input: JSON.stringify(tool.input, null, 2),
                        output: JSON.stringify(tool.output, null, 2),
                        timestamp: Date.now(),
                      },
                      ...prev,
                    ]);
                  }
                } else if (data.type === "error") {
                  fullText += `\n❌ ${data.content}`;
                  setStreamingText(fullText);
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }

          // Finalize message
          if (fullText) {
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: fullText,
                timestamp: Date.now(),
              },
            ]);
          }
          setStreamingText("");
        } else {
          // Non-streaming fallback
          const data = await res.json();
          if (data.toolCalls?.length > 0) {
            for (const tool of data.toolCalls) {
              setActions((prev) => [
                {
                  tool: tool.name,
                  status: "done",
                  input: JSON.stringify(tool.input, null, 2),
                  output: JSON.stringify(tool.output, null, 2),
                  timestamp: Date.now(),
                },
                ...prev,
              ]);
            }
          }
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.text || "Task completed.",
              timestamp: Date.now(),
            },
          ]);
        }
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `❌ Error: ${err.message || "Connection failed"}`,
            timestamp: Date.now(),
          },
        ]);
        setStreamingText("");
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
    <div className="flex h-screen bg-[var(--bg-primary)]">
      {/* Sidebar — Actions Panel */}
      <div className="w-80 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/20">
              ⚡
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Karya</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                AI Computer Agent • {taskCount} tasks
              </p>
            </div>
          </div>
        </div>

        {/* Actions Log */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            🔧 Tool Actions
          </h3>
          {actions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-2">🛠️</p>
              <p className="text-sm text-[var(--text-secondary)]">
                No actions yet
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Give Karya a command to see tools in action
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {actions.map((action, i) => (
                <details
                  key={i}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] overflow-hidden group"
                >
                  <summary className="flex items-center gap-2 p-3 cursor-pointer hover:bg-white/5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        action.status === "running"
                          ? "bg-yellow-500 animate-pulse"
                          : action.status === "done"
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                    <span className="text-xs font-mono text-purple-400 truncate flex-1">
                      {action.tool}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </span>
                  </summary>
                  <div className="px-3 pb-3 space-y-1">
                    {action.input && (
                      <div>
                        <span className="text-[10px] text-blue-400 uppercase font-semibold">
                          Input
                        </span>
                        <pre className="text-[11px] text-[var(--text-secondary)] bg-black/30 rounded p-2 overflow-x-auto max-h-24 mt-0.5">
                          {action.input}
                        </pre>
                      </div>
                    )}
                    {action.output && (
                      <div>
                        <span className="text-[10px] text-green-400 uppercase font-semibold">
                          Output
                        </span>
                        <pre className="text-[11px] text-green-400/80 bg-black/30 rounded p-2 overflow-x-auto max-h-32 mt-0.5">
                          {action.output.slice(0, 500)}
                          {action.output.length > 500 ? "..." : ""}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="p-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
            <span className="truncate">
              Ollama Cloud • gpt-oss:120b
            </span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 && !streamingText ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-4xl mb-6 shadow-lg shadow-purple-500/20">
                ⚡
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Karya</h2>
              <p className="text-[var(--text-secondary)] mb-8 max-w-md">
                I don&apos;t talk — I DO. Browser, files, commands, automation.
                Tell me what you need.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                {[
                  { icon: "🌐", text: "Google pe 'Mastra AI' search karo" },
                  { icon: "📁", text: "Desktop pe kya files hain?" },
                  { icon: "💻", text: "System info batao" },
                  { icon: "📋", text: "Clipboard mein kya hai?" },
                  { icon: "📝", text: "Create a test.txt file on Desktop" },
                  { icon: "🔍", text: "Find all PDF files in Downloads" },
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(`${example.text}`)}
                    className="text-left text-sm p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-purple-500/30 transition-all text-[var(--text-secondary)] flex items-start gap-2"
                  >
                    <span>{example.icon}</span>
                    <span>{example.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-purple-600 text-white"
                        : "bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)]"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-purple-400 text-xs">⚡</span>
                        <span className="text-[10px] text-purple-400 font-semibold uppercase">
                          Karya
                        </span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                    <p className="text-[10px] mt-1.5 opacity-40">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {/* Streaming text */}
              {streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-purple-400 text-xs">⚡</span>
                      <span className="text-[10px] text-purple-400 font-semibold uppercase">
                        Karya
                      </span>
                      <span className="ml-1 w-1.5 h-4 bg-purple-400 animate-pulse inline-block rounded-sm"></span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-[var(--text-primary)]">
                      {streamingText}
                    </p>
                  </div>
                </div>
              )}

              {/* Loading indicator (before streaming starts) */}
              {isLoading && !streamingText && (
                <div className="flex justify-start">
                  <div className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1 animate-thinking">
                        <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
                        <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
                        <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
                      </div>
                      <span className="text-sm text-[var(--text-secondary)]">
                        Karya is working...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-[var(--border)] p-4 bg-[var(--bg-secondary)]">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Bolo kya karna hai... (Hindi ya English)"
                  rows={1}
                  disabled={isLoading}
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 resize-none disabled:opacity-50"
                  style={{ minHeight: "48px", maxHeight: "120px" }}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="h-12 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium text-sm hover:from-purple-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 active:scale-95"
              >
                {isLoading ? (
                  <span className="animate-spin inline-block">⏳</span>
                ) : (
                  "⚡ Execute"
                )}
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)] mt-2 text-center">
              Karya can control your browser, manage files, run commands, and more.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
