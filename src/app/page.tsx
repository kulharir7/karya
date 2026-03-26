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

  useEffect(() => { const s = loadHistory(); if (s.length > 0) setMessages(s); }, []);
  useEffect(() => { if (messages.length > 0) saveHistory(messages); }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingText, streamingTools]);

  const handleClear = () => { setMessages([]); setTaskCount(0); clearHistory(); };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    const msg = input.trim();
    setInput(""); setIsLoading(true); setStreamingText(""); setStreamingTools([]); setTaskCount((c) => c + 1);

    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: messages.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok) throw new Error("Server error");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "", buffer = "";
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
            const d = JSON.parse(line.slice(6).trim());
            if (d.type === "text") { fullText += d.content; setStreamingText(fullText); }
            else if (d.type === "tool-call") { tools.push({ toolName: d.toolName, args: d.args, status: "running" }); setStreamingTools([...tools]); }
            else if (d.type === "tool-result") { const i = tools.findIndex((t) => t.toolName === d.toolName && t.status === "running"); if (i !== -1) { tools[i].result = d.result; tools[i].status = "done"; } setStreamingTools([...tools]); }
            else if (d.type === "error") { fullText += `\n❌ ${d.content}`; setStreamingText(fullText); }
          } catch {}
        }
      }

      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: fullText || "✅ Done.", timestamp: Date.now(), toolCalls: tools.map((t) => ({ ...t })) }]);
      setStreamingText(""); setStreamingTools([]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: `❌ ${err.message}`, timestamp: Date.now() }]);
      setStreamingText(""); setStreamingTools([]);
    } finally { setIsLoading(false); }
  }, [input, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } };

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm shadow-sm">⚡</div>
            <div>
              <div className="text-sm font-bold text-gray-900">Karya</div>
              <div className="text-[10px] text-gray-400">AI Computer Agent</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Chat</span>
          </div>
          <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-purple-700 bg-purple-50 font-medium">
            💬 Main
          </button>

          <div className="px-3 mt-4 mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Control</span>
          </div>
          {[
            { icon: "📊", label: "Overview", href: "#" },
            { icon: "🔧", label: "Tools", count: 22 },
            { icon: "📜", label: "History", count: taskCount },
          ].map((item) => (
            <button key={item.label} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
              <span>{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.count !== undefined && (
                <span className="text-[10px] text-gray-400">{item.count}</span>
              )}
            </button>
          ))}

          <div className="px-3 mt-4 mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Agent</span>
          </div>
          <Link href="/settings" className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
            ⚙️ <span>Settings</span>
          </Link>
        </div>

        {/* Bottom */}
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span>v0.1.0</span>
            <span>•</span>
            <span>gpt-oss:120b</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-5 shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-500 flex-1">
            <span className="text-gray-300">Karya</span>
            <span className="text-gray-300">›</span>
            <span className="font-medium text-gray-800">Chat</span>
          </div>
          <div className="flex items-center gap-4">
            {isLoading && (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                <span className="text-xs text-purple-600">Working...</span>
              </div>
            )}
            <span className="text-xs text-gray-400">gpt-oss:120b</span>
            <button onClick={handleClear} className="text-xs text-gray-400 hover:text-red-500 transition-colors" title="Clear chat">🗑️</button>
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg-primary)]">
          {messages.length === 0 && !streamingText ? (
            <div className="flex flex-col items-center justify-center h-full px-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xl mb-4 shadow-lg shadow-purple-500/10">⚡</div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">What should I do?</h2>
              <p className="text-sm text-gray-400 mb-8">I execute tasks on your computer — browser, files, commands</p>
              <div className="grid grid-cols-3 gap-3 max-w-xl w-full">
                {[
                  { icon: "💻", text: "System info batao" },
                  { icon: "📁", text: "Desktop pe files dikhao" },
                  { icon: "🔍", text: "Search 'Mastra AI'" },
                  { icon: "📋", text: "Clipboard mein kya hai?" },
                  { icon: "📄", text: "Downloads mein PDFs dhundho" },
                  { icon: "📝", text: "Desktop pe test.txt banao" },
                ].map((ex, i) => (
                  <button key={i} onClick={() => setInput(ex.text)}
                    className="text-left p-3 rounded-lg border border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm transition-all group">
                    <span className="text-base">{ex.icon}</span>
                    <p className="text-xs text-gray-500 group-hover:text-gray-700 mt-1 leading-tight">{ex.text}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-5 py-5 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" && (
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mt-0.5">U</div>
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">You · {new Date(msg.timestamp).toLocaleTimeString()}</div>
                        <p className="text-sm text-gray-800">{msg.content}</p>
                      </div>
                    </div>
                  )}
                  {msg.role === "assistant" && (
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs shrink-0 mt-0.5">⚡</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-400 mb-1">Karya · {new Date(msg.timestamp).toLocaleTimeString()}</div>
                        {msg.toolCalls?.map((tool, i) => (
                          <ToolCard key={i} toolName={tool.toolName} status={tool.status === "done" ? "done" : "error"} args={tool.args} result={tool.result} />
                        ))}
                        {msg.content && <div className="mt-1"><MessageContent content={msg.content} /></div>}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming */}
              {(streamingTools.length > 0 || streamingText || (isLoading && !streamingText && streamingTools.length === 0)) && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs shrink-0 mt-0.5">⚡</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400 mb-1">Karya</div>
                    {streamingTools.map((tool, i) => (
                      <ToolCard key={i} toolName={tool.toolName} status={tool.status} args={tool.args} result={tool.result} />
                    ))}
                    {streamingText && (
                      <div className="mt-1">
                        <MessageContent content={streamingText} />
                        <span className="inline-block w-0.5 h-4 bg-purple-500 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
                      </div>
                    )}
                    {isLoading && !streamingText && streamingTools.length === 0 && (
                      <div className="flex items-center gap-2 py-1">
                        <div className="flex gap-1 animate-thinking">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        </div>
                        <span className="text-xs text-gray-400">Thinking...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white p-4 shrink-0">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
              <textarea
                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Message Karya (Enter to send)"
                rows={1} disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none resize-none disabled:opacity-50"
                style={{ minHeight: "24px", maxHeight: "100px" }}
              />
              <button type="submit" disabled={isLoading || !input.trim()}
                className="w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center disabled:opacity-30 transition-all shrink-0 shadow-sm">
                {isLoading ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
