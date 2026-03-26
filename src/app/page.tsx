"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  toolName?: string;
  isStreaming?: boolean;
}

interface ToolAction {
  tool: string;
  status: "running" | "done" | "error";
  input?: string;
  output?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [actions, setActions] = useState<ToolAction[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setActions([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          history: messages.map((m) => ({
            role: m.role === "tool" ? "assistant" : m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      // Add tool actions if any
      if (data.toolCalls && data.toolCalls.length > 0) {
        for (const tool of data.toolCalls) {
          setActions((prev) => [
            ...prev,
            {
              tool: tool.name,
              status: "done",
              input: JSON.stringify(tool.input, null, 2),
              output: JSON.stringify(tool.output, null, 2),
            },
          ]);
        }
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.text || "Task completed.",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "❌ Error connecting to Karya backend. Make sure the server is running.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      {/* Sidebar - Actions Panel */}
      <div className="w-80 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
              K
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Karya</h1>
              <p className="text-xs text-[var(--text-secondary)]">AI Computer Agent</p>
            </div>
          </div>
        </div>

        {/* Actions Log */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            🔧 Actions
          </h3>
          {actions.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] italic">
              No actions yet. Give Karya a command!
            </p>
          ) : (
            <div className="space-y-3">
              {actions.map((action, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        action.status === "running"
                          ? "bg-yellow-500 animate-pulse"
                          : action.status === "done"
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                    <span className="text-sm font-mono text-purple-400">
                      {action.tool}
                    </span>
                  </div>
                  {action.input && (
                    <pre className="text-xs text-[var(--text-secondary)] bg-black/30 rounded p-2 overflow-x-auto max-h-24">
                      {action.input}
                    </pre>
                  )}
                  {action.output && (
                    <pre className="text-xs text-green-400/80 bg-black/30 rounded p-2 mt-1 overflow-x-auto max-h-32">
                      {action.output.slice(0, 500)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="p-3 border-t border-[var(--border)] text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>Ollama Cloud • qwen3-coder:480b</span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-4xl mb-6 shadow-lg shadow-purple-500/20">
                ⚡
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Karya AI</h2>
              <p className="text-[var(--text-secondary)] mb-8 max-w-md">
                I don't just talk — I DO things. Browser, files, commands, automation.
                Tell me what you need.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                {[
                  "🌐 Google pe 'Mastra AI' search karo",
                  "📁 Desktop pe kya files hain?",
                  "💻 System info batao",
                  "📋 Clipboard mein kya hai?",
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(example)}
                    className="text-left text-sm p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-purple-500/30 transition-all text-[var(--text-secondary)]"
                  >
                    {example}
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
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-[10px] mt-1 opacity-50">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-400">⚡</span>
                      <span className="text-sm text-[var(--text-secondary)]">
                        Karya is working
                      </span>
                      <span className="animate-thinking flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block"></span>
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
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Bolo kya karna hai... (Hindi ya English)"
                  rows={1}
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 resize-none"
                  style={{ minHeight: "48px", maxHeight: "120px" }}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="h-12 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium text-sm hover:from-purple-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
              >
                {isLoading ? "⏳" : "⚡ Execute"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
