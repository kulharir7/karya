"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import ToolCard from "./components/ToolCard";
import MessageContent from "./components/MessageContent";
import CommandPalette from "./components/CommandPalette";
import {
  getSessions, saveSessions, getActiveSessionId, setActiveSessionId,
  getSessionMessages, saveSessionMessages, createSession, deleteSession,
  type Session,
} from "@/lib/sessions";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: { toolName: string; args?: any; result?: any; status: string }[];
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState("default");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingTools, setStreamingTools] = useState<
    { toolName: string; args?: any; result?: any; status: "running" | "done" }[]
  >([]);
  const [taskCount, setTaskCount] = useState(0);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load sessions
  useEffect(() => {
    const s = getSessions();
    if (s.length === 0) {
      const def: Session = { id: "default", name: "Main", createdAt: Date.now(), lastMessageAt: Date.now(), messageCount: 0 };
      saveSessions([def]);
      setSessions([def]);
    } else {
      setSessions(s);
    }
    const aid = getActiveSessionId();
    setActiveId(aid);
    setMessages(getSessionMessages(aid));
  }, []);

  // Save messages
  useEffect(() => {
    if (messages.length > 0) {
      saveSessionMessages(activeId, messages);
      const updated = sessions.map((s) =>
        s.id === activeId ? { ...s, lastMessageAt: Date.now(), messageCount: messages.length } : s
      );
      saveSessions(updated);
      setSessions(updated);
    }
  }, [messages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingText, streamingTools]);

  // Ctrl+K
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setCmdOpen((v) => !v); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const switchSession = (id: string) => {
    setActiveId(id);
    setActiveSessionId(id);
    setMessages(getSessionMessages(id));
  };

  const newSession = () => {
    const s = createSession();
    setSessions(getSessions());
    setActiveId(s.id);
    setMessages([]);
  };

  const delSession = (id: string) => {
    deleteSession(id);
    const remaining = getSessions();
    setSessions(remaining);
    if (id === activeId && remaining.length > 0) {
      switchSession(remaining[0].id);
    }
  };

  // File drop handler
  const handleFileDrop = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (data.success) {
          setInput((prev) => prev + (prev ? " " : "") + `[Uploaded: ${data.name} (${data.sizeFormatted}) → ${data.path}]`);
        }
      } catch {}
    }
    setDragging(false);
  };

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
        const lines = buffer.split("\n"); buffer = lines.pop() || "";
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

  const currentSession = sessions.find((s) => s.id === activeId);

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); handleFileDrop(e.dataTransfer.files); }}>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onSelect={(a) => { setInput(a); setCmdOpen(false); }} />

      {/* Drop overlay */}
      {dragging && (
        <div className="fixed inset-0 z-40 bg-purple-500/10 border-2 border-dashed border-purple-400 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl shadow-lg px-8 py-6 text-center">
            <p className="text-3xl mb-2">📎</p>
            <p className="text-sm font-medium text-gray-800">Drop files here</p>
            <p className="text-xs text-gray-400">Files will be uploaded and available for Karya</p>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs shadow-sm">⚡</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gray-900">Karya</div>
              <div className="text-[9px] text-gray-400">AI Computer Agent</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Sessions */}
          <div className="px-3 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Chats</span>
            <button onClick={newSession} className="text-[10px] text-purple-600 hover:text-purple-800 font-medium">+ New</button>
          </div>
          {sessions.map((s) => (
            <div key={s.id} className={`group flex items-center gap-2 px-4 py-2 text-sm cursor-pointer transition-colors ${s.id === activeId ? "text-purple-700 bg-purple-50 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
              <button onClick={() => switchSession(s.id)} className="flex-1 text-left truncate">
                💬 {s.name}
              </button>
              {s.id !== "default" && (
                <button onClick={() => delSession(s.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs transition-opacity">✕</button>
              )}
            </div>
          ))}

          {/* Control */}
          <div className="px-3 mt-4 mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Control</span>
          </div>
          <button onClick={() => setCmdOpen(true)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            🔍 <span className="flex-1 text-left">Command</span>
            <kbd className="text-[9px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded">⌘K</kbd>
          </button>
          <Link href="/settings" className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            ⚙️ Settings
          </Link>
          <Link href="/help" className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            ❓ Help & Docs
          </Link>
        </div>

        <div className="px-3 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <span className="text-[9px] text-white font-bold">K</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-gray-700 truncate">Karya v0.1</div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="truncate">gpt-oss:120b</span>
                <span>•</span>
                <span>{taskCount} tasks</span>
              </div>
            </div>
          </div>
          <button onClick={() => {
            const text = messages.map((m) => `[${m.role === "user" ? "You" : "Karya"}]\n${m.content}`).join("\n\n---\n\n");
            const blob = new Blob([text], { type: "text/plain" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `karya-chat-${new Date().toISOString().slice(0,10)}.txt`; a.click();
          }} className="w-full text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md py-1.5 transition-all text-center">
            📥 Export Chat
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-11 bg-white border-b border-gray-200 flex items-center px-5 shrink-0">
          <div className="flex items-center gap-2 text-sm flex-1">
            <span className="text-gray-300">Karya ›</span>
            <span className="font-medium text-gray-800">{currentSession?.name || "Chat"}</span>
          </div>
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              <span className="text-xs text-purple-600">Working...</span>
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg-primary)]">
          {messages.length === 0 && !streamingText ? (
            <div className="flex flex-col items-center justify-center h-full px-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xl mb-4 shadow-md">⚡</div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">What should I do?</h2>
              <p className="text-sm text-gray-400 mb-6">Execute tasks • Browse web • Manage files • Run commands</p>
              <div className="grid grid-cols-3 gap-2.5 max-w-xl w-full">
                {[
                  { icon: "💻", text: "System info" },
                  { icon: "📁", text: "List Desktop files" },
                  { icon: "🔍", text: "Search 'Mastra AI'" },
                  { icon: "🕐", text: "What time is it?" },
                  { icon: "📊", text: "Running processes" },
                  { icon: "📋", text: "Clipboard contents" },
                ].map((ex, i) => (
                  <button key={i} onClick={() => setInput(ex.text)} className="text-left p-3 rounded-lg border border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm transition-all">
                    <span className="text-base">{ex.icon}</span>
                    <p className="text-xs text-gray-500 mt-1">{ex.text}</p>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-300 mt-4">Drag & drop files • Ctrl+K for commands</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-5 py-5 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" && (
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0 mt-0.5">U</div>
                      <div><div className="text-[10px] text-gray-400 mb-0.5">You · {new Date(msg.timestamp).toLocaleTimeString()}</div><p className="text-sm text-gray-800">{msg.content}</p></div>
                    </div>
                  )}
                  {msg.role === "assistant" && (
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs shrink-0 mt-0.5">⚡</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-gray-400 mb-1">Karya · {new Date(msg.timestamp).toLocaleTimeString()}</div>
                        {msg.toolCalls?.map((t, i) => <ToolCard key={i} toolName={t.toolName} status={t.status === "done" ? "done" : "error"} args={t.args} result={t.result} />)}
                        {msg.content && <div className="mt-1"><MessageContent content={msg.content} /></div>}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {(streamingTools.length > 0 || streamingText || (isLoading && !streamingText && streamingTools.length === 0)) && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs shrink-0 mt-0.5">⚡</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-gray-400 mb-1">Karya</div>
                    {streamingTools.map((t, i) => <ToolCard key={i} toolName={t.toolName} status={t.status} args={t.args} result={t.result} />)}
                    {streamingText && <div className="mt-1"><MessageContent content={streamingText} /><span className="inline-block w-0.5 h-4 bg-purple-500 animate-pulse rounded-sm ml-0.5 align-text-bottom" /></div>}
                    {isLoading && !streamingText && streamingTools.length === 0 && (
                      <div className="flex items-center gap-2 py-1"><div className="flex gap-1 animate-thinking"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" /><span className="w-1.5 h-1.5 rounded-full bg-purple-400" /><span className="w-1.5 h-1.5 rounded-full bg-purple-400" /></div><span className="text-xs text-gray-400">Thinking...</span></div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white p-3 shrink-0">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
              <label className="cursor-pointer text-gray-400 hover:text-gray-600 transition-colors shrink-0 pb-0.5">
                <input type="file" className="hidden" multiple onChange={(e) => e.target.files && handleFileDrop(e.target.files)} />
                📎
              </label>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Message Karya... (Enter to send, Ctrl+K for commands)"
                rows={1} disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none resize-none disabled:opacity-50"
                style={{ minHeight: "24px", maxHeight: "100px" }} />
              <button type="submit" disabled={isLoading || !input.trim()}
                className="w-7 h-7 rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center disabled:opacity-30 transition-all shrink-0 shadow-sm">
                {isLoading ? <div className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" /> :
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
