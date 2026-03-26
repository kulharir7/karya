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

type Tab = "chat" | "tools" | "history";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingTools, setStreamingTools] = useState<
    { toolName: string; args?: any; result?: any; status: "running" | "done" }[]
  >([]);
  const [taskCount, setTaskCount] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
      setActiveTab("chat");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: currentInput,
            history: messages.map((m) => ({ role: m.role, content: m.content })),
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
                tools.push({ toolName: data.toolName, args: data.args, status: "running" });
                setStreamingTools([...tools]);
              } else if (data.type === "tool-result") {
                const idx = tools.findIndex((t) => t.toolName === data.toolName && t.status === "running");
                if (idx !== -1) { tools[idx].result = data.result; tools[idx].status = "done"; }
                setStreamingTools([...tools]);
              } else if (data.type === "error") {
                fullText += `\n❌ ${data.content}`;
                setStreamingText(fullText);
              }
            } catch {}
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: fullText || "✅ Done.",
            timestamp: Date.now(),
            toolCalls: tools.map((t) => ({ ...t, status: t.status })),
          },
        ]);
        setStreamingText("");
        setStreamingTools([]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: "assistant", content: `❌ ${err.message}`, timestamp: Date.now() },
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  // All tool actions from messages
  const allToolActions = messages
    .filter((m) => m.toolCalls && m.toolCalls.length > 0)
    .flatMap((m) => m.toolCalls!.map((t) => ({ ...t, time: m.timestamp })))
    .reverse();

  return (
    <div className="flex h-screen bg-[#0c0c14] text-white overflow-hidden select-none">
      {/* Left Nav Rail */}
      <div className="w-14 bg-[#08080e] border-r border-white/5 flex flex-col items-center py-3 gap-1 shrink-0">
        {/* Logo */}
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-sm font-bold mb-4 shadow-lg shadow-purple-500/20">
          ⚡
        </div>

        {/* Nav items */}
        {[
          { id: "chat" as Tab, icon: "💬", label: "Chat" },
          { id: "tools" as Tab, icon: "🔧", label: "Tools" },
          { id: "history" as Tab, icon: "📜", label: "History" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id); setSidebarOpen(true); }}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-base transition-all ${
              activeTab === item.id
                ? "bg-purple-500/20 text-white"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}
            title={item.label}
          >
            {item.icon}
          </button>
        ))}

        <div className="flex-1" />

        {/* Bottom actions */}
        <Link
          href="/settings"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-base text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
          title="Settings"
        >
          ⚙️
        </Link>
      </div>

      {/* Sidebar Panel */}
      {sidebarOpen && activeTab !== "chat" && (
        <div className="w-72 bg-[#0e0e18] border-r border-white/5 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              {activeTab === "tools" ? "Tool Activity" : "Chat History"}
            </h2>
            <button onClick={() => setSidebarOpen(false)} className="text-white/30 hover:text-white/60 text-xs">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === "tools" && (
              <div className="space-y-2">
                {allToolActions.length === 0 ? (
                  <p className="text-xs text-white/30 text-center py-8">No tool calls yet</p>
                ) : (
                  allToolActions.slice(0, 30).map((t, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-2.5 border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        <span className="text-xs font-mono text-purple-300 truncate">{t.toolName}</span>
                      </div>
                      <p className="text-[10px] text-white/30 mt-1">
                        {new Date(t.time).toLocaleTimeString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-2">
                {messages.filter((m) => m.role === "user").length === 0 ? (
                  <p className="text-xs text-white/30 text-center py-8">No messages yet</p>
                ) : (
                  messages
                    .filter((m) => m.role === "user")
                    .reverse()
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setInput(m.content); setActiveTab("chat"); }}
                        className="w-full text-left bg-white/5 rounded-lg p-2.5 border border-white/5 hover:border-purple-500/30 transition-all"
                      >
                        <p className="text-xs text-white/80 truncate">{m.content}</p>
                        <p className="text-[10px] text-white/30 mt-1">
                          {new Date(m.timestamp).toLocaleString()}
                        </p>
                      </button>
                    ))
                )}
                {messages.length > 0 && (
                  <button onClick={handleClear} className="w-full text-xs text-red-400/60 hover:text-red-400 py-2 transition-colors">
                    🗑️ Clear All History
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Title Bar */}
        <div className="h-11 bg-[#0a0a12] border-b border-white/5 flex items-center px-4 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-bold text-white/80">KARYA</span>
            <span className="text-[10px] text-white/30">•</span>
            <span className="text-[10px] text-white/30">AI Computer Agent</span>
          </div>
          <div className="flex items-center gap-3">
            {isLoading && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                <span className="text-[10px] text-purple-400">Working...</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] text-white/30">gpt-oss:120b</span>
            </div>
            <span className="text-[10px] text-white/20">{taskCount} tasks</span>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !streamingText ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-full px-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/80 to-indigo-600/80 flex items-center justify-center text-2xl mb-4 shadow-lg shadow-purple-500/10">
                ⚡
              </div>
              <h2 className="text-lg font-semibold text-white/90 mb-1">What should I do?</h2>
              <p className="text-xs text-white/40 mb-6">I execute tasks on your computer — browser, files, commands</p>

              <div className="grid grid-cols-3 gap-2 max-w-xl w-full">
                {[
                  { icon: "💻", text: "System info batao", cat: "System" },
                  { icon: "📁", text: "Desktop pe files dikhao", cat: "Files" },
                  { icon: "🔍", text: "Search 'Mastra AI'", cat: "Browser" },
                  { icon: "📋", text: "Clipboard mein kya hai?", cat: "System" },
                  { icon: "📄", text: "Downloads mein PDFs dhundho", cat: "Files" },
                  { icon: "📝", text: "Desktop pe test.txt banao", cat: "Files" },
                ].map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(ex.text)}
                    className="group text-left p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-purple-500/20 hover:bg-purple-500/5 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{ex.icon}</span>
                      <span className="text-[9px] text-white/20 uppercase font-medium">{ex.cat}</span>
                    </div>
                    <p className="text-xs text-white/60 group-hover:text-white/80 leading-tight">{ex.text}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="max-w-3xl mx-auto px-4 py-5 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" && (
                    <div className="flex justify-end mb-1">
                      <div className="max-w-[75%] bg-purple-600/90 backdrop-blur rounded-2xl rounded-br-sm px-4 py-2.5 shadow-lg shadow-purple-500/10">
                        <p className="text-sm text-white">{msg.content}</p>
                      </div>
                    </div>
                  )}

                  {msg.role === "assistant" && (
                    <div className="flex justify-start mb-1">
                      <div className="max-w-[88%] space-y-1.5">
                        {msg.toolCalls?.map((tool, i) => (
                          <ToolCard key={i} toolName={tool.toolName} status={tool.status === "done" ? "done" : "error"} args={tool.args} result={tool.result} />
                        ))}
                        {msg.content && (
                          <div className="bg-white/[0.04] border border-white/5 rounded-2xl rounded-bl-sm px-4 py-3">
                            <MessageContent content={msg.content} />
                            <p className="text-[9px] mt-2 text-white/20">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming tools */}
              {streamingTools.length > 0 && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] space-y-1.5">
                    {streamingTools.map((tool, i) => (
                      <ToolCard key={i} toolName={tool.toolName} status={tool.status} args={tool.args} result={tool.result} />
                    ))}
                  </div>
                </div>
              )}

              {/* Streaming text */}
              {streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] bg-white/[0.04] border border-white/5 rounded-2xl rounded-bl-sm px-4 py-3">
                    <MessageContent content={streamingText} />
                    <span className="inline-block w-1 h-4 bg-purple-400 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
                  </div>
                </div>
              )}

              {/* Thinking dots */}
              {isLoading && !streamingText && streamingTools.length === 0 && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.04] border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <div className="flex gap-1 animate-thinking">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    </div>
                    <span className="text-xs text-white/40">Karya is thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-white/5 bg-[#0a0a12] p-3 shrink-0">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell Karya what to do..."
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-white/[0.04] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 resize-none disabled:opacity-50 transition-all"
              style={{ minHeight: "42px", maxHeight: "100px" }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-[42px] w-[42px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/10 active:scale-95 shrink-0"
            >
              {isLoading ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
