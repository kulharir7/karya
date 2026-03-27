"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import ToolCard from "./components/ToolCard";
import MessageContent from "./components/MessageContent";
import CommandPalette from "./components/CommandPalette";
// Server-side session management — no more localStorage for sessions/messages

// ─── Sidebar Components (OpenClaw-style) ───

// ─── SVG Icons (OpenClaw-style line icons) ───
const icons = {
  chat: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  dashboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  memory: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z"/></svg>,
  sessions: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  events: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  agents: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 00-16 0"/></svg>,
  mcp: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  tools: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  help: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5"/></svg>,
  export: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  automation: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>,
  debug: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v4M12 16h.01"/></svg>,
  logs: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>,
  chevron: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>,
};

function SidebarSection({ title, children, defaultOpen = true, action }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3 first:mt-2">
      <div className="flex items-center justify-between px-4 py-1.5">
        <div onClick={() => setOpen(!open)} className="flex items-center gap-1 cursor-pointer flex-1 select-none">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={`transition-transform duration-200 text-[var(--text-muted)] ${open ? "rotate-90" : ""}`}>
            <path d="M9 6l6 6-6 6"/>
          </svg>
          <span className="sidebar-section-title !p-0">{title}</span>
        </div>
        {action && <div className="flex items-center">{action}</div>}
      </div>
      {open && <div className="space-y-0.5 mt-1">{children}</div>}
    </div>
  );
}

function SidebarNavItem({ icon, label, active, onClick, onDelete, badge }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; onDelete?: () => void; badge?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`sidebar-item ${active ? "active" : ""}`}
    >
      <span className="shrink-0 text-[var(--sidebar-text-muted)]">{icon}</span>
      <span className="flex-1 text-[13px] truncate">{label}</span>
      {badge && (
        <kbd className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded font-mono border border-[var(--border)]">{badge}</kbd>
      )}
      {onDelete && (
        <span
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--error)] text-xs transition-opacity"
        >✕</span>
      )}
    </div>
  );
}

function SidebarNavLink({ icon, label, href, active }: { icon: React.ReactNode; label: string; href: string; active?: boolean }) {
  return (
    <Link href={href} className={`sidebar-item ${active ? "active" : ""}`}>
      <span className="shrink-0 text-[var(--sidebar-text-muted)]">{icon}</span>
      <span className="flex-1 text-[13px] truncate">{label}</span>
    </Link>
  );
}

// ─── Thinking Indicator ───
function ThinkingIndicator({ agent, currentTool }: { 
  agent: { agent: string; confidence: number; reason: string } | null;
  currentTool?: string;
}) {
  const [phase, setPhase] = useState(0);
  const [dots, setDots] = useState(1);
  
  const agentEmoji: Record<string, string> = {
    browser: "🌐", file: "📁", coder: "💻", researcher: "🔍", "data-analyst": "📊", supervisor: "⚡"
  };
  
  const agentLabel: Record<string, string> = {
    browser: "Browser Agent", file: "File Agent", coder: "Coder Agent", 
    researcher: "Research Agent", "data-analyst": "Data Analyst", supervisor: "Karya"
  };

  const phases = agent?.reason
    ? [agent.reason]
    : currentTool
    ? [`Using ${currentTool}`]
    : ["Analyzing request", "Thinking", "Planning approach", "Preparing response"];

  useEffect(() => {
    const phaseInterval = setInterval(() => setPhase(p => (p + 1) % phases.length), 3000);
    const dotsInterval = setInterval(() => setDots(d => (d % 3) + 1), 500);
    return () => { clearInterval(phaseInterval); clearInterval(dotsInterval); };
  }, [phases.length]);

  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)] animate-fade-in">
      {/* Animated spinner */}
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-full border-2 border-[var(--accent)]/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)] animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-sm">
          {agent ? agentEmoji[agent.agent] || "⚡" : "🧠"}
        </div>
      </div>
      
      {/* Status text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {agent ? agentLabel[agent.agent] || "Processing" : "Karya"}
          </span>
          {agent && agent.confidence && (
            <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded">
              {Math.round(agent.confidence * 100)}% confidence
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--text-muted)] truncate">
          {phases[phase]}{".".repeat(dots)}
        </div>
      </div>
      
      {/* Current tool indicator */}
      {currentTool && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--accent)] bg-[var(--accent-light)] px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          {currentTool}
        </div>
      )}
    </div>
  );
}

interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: { toolName: string; args?: any; result?: any; status: string }[];
  images?: string[]; // Image data URLs for display
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
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [activeAgent, setActiveAgent] = useState<{ agent: string; confidence: number; reason: string } | null>(null);
  const [pendingImages, setPendingImages] = useState<Array<{ base64: string; mimeType: string; name: string; preview: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Dark mode
  useEffect(() => {
    const saved = localStorage.getItem("karya-dark") === "true";
    setDark(saved);
    document.documentElement.classList.toggle("dark", saved);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("karya-dark", String(next));
  };

  // Scroll detection
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const handler = () => {
      const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(fromBottom > 200);
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  // Load sessions from server
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {}
  }, []);

  const loadMessages = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/sessions?id=${sid}&limit=100`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          toolCalls: m.toolCalls,
        })));
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Load sessions from server on mount
    loadSessions();
    const savedActive = localStorage.getItem("karya-active-session") || "default";
    setActiveId(savedActive);
    loadMessages(savedActive);
  }, [loadSessions, loadMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingText, streamingTools]);

  // Ctrl+K
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setCmdOpen((v) => !v); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const switchSession = useCallback(async (id: string) => {
    setActiveId(id);
    localStorage.setItem("karya-active-session", id);
    await loadMessages(id);
  }, [loadMessages]);

  const newSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        setActiveId(data.session.id);
        localStorage.setItem("karya-active-session", data.session.id);
        setMessages([]);
        await loadSessions();
      }
    } catch {}
  }, [loadSessions]);

  const delSession = useCallback(async (id: string) => {
    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      await loadSessions();
      if (id === activeId) {
        setActiveId("default");
        localStorage.setItem("karya-active-session", "default");
        await loadMessages("default");
      }
    } catch {}
  }, [activeId, loadSessions, loadMessages]);

  // Image types for vision
  const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  // File drop handler — images go to pendingImages, others to text
  const handleFileDrop = async (files: FileList) => {
    for (const file of Array.from(files)) {
      // Check if image
      if (IMAGE_TYPES.includes(file.type)) {
        // Read as base64 for vision
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          setPendingImages((prev) => [...prev, {
            base64,
            mimeType: file.type,
            name: file.name,
            preview: reader.result as string, // Full data URL for preview
          }]);
        };
        reader.readAsDataURL(file);
      } else {
        // Non-image: upload and add path to input
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
    }
    setDragging(false);
  };

  // Remove pending image
  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && pendingImages.length === 0) || isLoading) return;

    // Include image previews in the displayed message
    const hasImages = pendingImages.length > 0;
    const userMsg: Message & { images?: string[] } = { 
      id: Date.now().toString(), 
      role: "user", 
      content: input.trim() || (hasImages ? "[Image attached]" : ""), 
      timestamp: Date.now(),
      images: hasImages ? pendingImages.map(img => img.preview) : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    
    const msg = input.trim() || "What's in this image?"; // Default prompt for image-only
    const imagesToSend = pendingImages.map(img => ({ base64: img.base64, mimeType: img.mimeType, name: img.name }));
    
    setInput(""); setPendingImages([]); setIsLoading(true); setStreamingText(""); setStreamingTools([]); setTaskCount((c) => c + 1);

    // Abort controller for cancel button (Point 56)
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: msg, 
          sessionId: activeId,
          images: imagesToSend.length > 0 ? imagesToSend : undefined,
        }),
        signal: abortController.signal,
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
            if (d.type === "text-delta" || d.type === "text") { fullText += d.content; setStreamingText(fullText); }
            else if (d.type === "session") {
              if (d.sessionId && d.sessionId !== activeId) {
                setActiveId(d.sessionId);
                localStorage.setItem("karya-active-session", d.sessionId);
              }
            }
            else if (d.type === "agent-route") {
              setActiveAgent({ agent: d.agent, confidence: d.confidence, reason: d.reason });
            }
            else if (d.type === "tool-call") { tools.push({ toolName: d.toolName, args: d.args, status: "running" }); setStreamingTools([...tools]); }
            else if (d.type === "tool-result") { const i = tools.findIndex((t) => t.toolName === d.toolName && t.status === "running"); if (i !== -1) { tools[i].result = d.result; tools[i].status = "done"; } setStreamingTools([...tools]); }
            else if (d.type === "error") { fullText += `\n❌ ${d.content}`; setStreamingText(fullText); }
          } catch {}
        }
      }

      // Add assistant message locally (server already persisted it)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(), role: "assistant" as const,
          content: fullText || "✅ Done.", timestamp: Date.now(),
          toolCalls: tools.map((t) => ({ ...t })),
        },
      ]);
      setStreamingText(""); setStreamingTools([]); setActiveAgent(null);

      // Refresh session list (name may have been auto-updated)
      loadSessions();
    } catch (err: any) {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: `❌ ${err.message}`, timestamp: Date.now() }]);
      setStreamingText(""); setStreamingTools([]); setActiveAgent(null);
    } finally { setIsLoading(false); }
  }, [input, isLoading, activeId, loadSessions, pendingImages]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } };

  // Quick submit — for example buttons (reuses handleSubmit logic)
  const quickSend = useCallback((text: string) => {
    if (isLoading) return;
    // Directly trigger send flow
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true); setStreamingText(""); setStreamingTools([]); setTaskCount((c) => c + 1);
    setInput("");

    fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, sessionId: activeId }),
    }).then(async (res) => {
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
            if (d.type === "text-delta" || d.type === "text") { fullText += d.content; setStreamingText(fullText); }
            else if (d.type === "session" && d.sessionId) {
              setActiveId(d.sessionId);
              localStorage.setItem("karya-active-session", d.sessionId);
            }
            else if (d.type === "agent-route") {
              setActiveAgent({ agent: d.agent, confidence: d.confidence, reason: d.reason });
            }
            else if (d.type === "tool-call") { tools.push({ toolName: d.toolName, args: d.args, status: "running" }); setStreamingTools([...tools]); }
            else if (d.type === "tool-result") { const i = tools.findIndex((t) => t.toolName === d.toolName && t.status === "running"); if (i !== -1) { tools[i].result = d.result; tools[i].status = "done"; } setStreamingTools([...tools]); }
            else if (d.type === "error") { fullText += `\n❌ ${d.content}`; setStreamingText(fullText); }
          } catch {}
        }
      }
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: fullText || "✅ Done.", timestamp: Date.now(), toolCalls: tools.map((t) => ({ ...t })) }]);
      setStreamingText(""); setStreamingTools([]); setActiveAgent(null);
      loadSessions();
    }).catch((err) => {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: `❌ ${err.message}`, timestamp: Date.now() }]);
      setStreamingText(""); setStreamingTools([]);
    }).finally(() => { setIsLoading(false); });
  }, [isLoading, activeId, loadSessions]);

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

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:static z-40 w-[240px] sidebar flex flex-col shrink-0 h-full transition-transform duration-200`}>
        {/* Logo */}
        <div className="px-4 py-3.5 border-b border-[var(--sidebar-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-purple-500/20">⚡</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[var(--text-primary)] tracking-tight">Karya</div>
              <div className="text-[9px] text-[var(--text-muted)] font-medium">AI Computer Agent</div>
            </div>
            <button 
              onClick={toggleDark} 
              className="w-8 h-8 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--accent-light)] flex items-center justify-center transition-all"
              title={dark ? "Light mode" : "Dark mode"}
            >
              <span className="text-base">{dark ? "☀️" : "🌙"}</span>
            </button>
          </div>
        </div>

        {/* Navigation sections */}
        <div className="flex-1 overflow-y-auto sidebar-scroll">
          {/* ─── CONTROL ─── */}
          <SidebarSection title="CONTROL" defaultOpen={true}>
            <SidebarNavLink icon={icons.dashboard} label="Dashboard" href="/dashboard" />
            <SidebarNavItem icon={icons.search} label="Command" onClick={() => setCmdOpen(true)} badge="⌘K" />
            <SidebarNavLink icon={icons.tools} label="Tools & Help" href="/help" />
            <SidebarNavLink icon={icons.settings} label="Settings" href="/settings" />
          </SidebarSection>

          {/* ─── PAGES ─── */}
          <SidebarSection title="PAGES" defaultOpen={true}>
            <SidebarNavLink icon={icons.automation} label="Workflows" href="/workflows" />
            <SidebarNavLink icon={icons.sessions} label="Tasks" href="/tasks" />
            <SidebarNavLink icon={icons.memory} label="Memory" href="/memory" />
            <SidebarNavLink icon={icons.logs} label="Audit Log" href="/audit" />
          </SidebarSection>

          {/* ─── CHATS ─── */}
          <SidebarSection title="CHATS" defaultOpen={true} action={
            <button onClick={newSession} className="text-[#5a5a72] hover:text-white transition-colors">
              {icons.plus}
            </button>
          }>
            {sessions.slice(0, 10).map((s) => (
              <SidebarNavItem
                key={s.id}
                icon={icons.chat}
                label={s.name}
                active={s.id === activeId}
                onClick={() => switchSession(s.id)}
                onDelete={s.id !== "default" ? () => delSession(s.id) : undefined}
              />
            ))}
            {sessions.length === 0 && (
              <div className="px-4 py-2 text-[11px] text-[#5a5a72]">No chats yet</div>
            )}
          </SidebarSection>

          {/* ─── DEV / DEBUG ─── */}
          <SidebarSection title="DEBUG" defaultOpen={false}>
            <SidebarNavItem icon={icons.export} label="Export Chat" onClick={() => {
              const text = messages.map((m) => `[${m.role === "user" ? "You" : "Karya"}]\n${m.content}`).join("\n\n---\n\n");
              const blob = new Blob([text], { type: "text/plain" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `karya-chat-${new Date().toISOString().slice(0,10)}.txt`; a.click();
            }} />
          </SidebarSection>
        </div>

        {/* Bottom status bar */}
        <div className="px-3 py-3 border-t border-[var(--sidebar-border)]">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <span className="text-xs text-white font-bold">K</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[var(--sidebar-bg)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--text-primary)] truncate">Karya v1.0</div>
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                <span className="truncate">gpt-oss:120b</span>
                <span>•</span>
                <span>{taskCount} tasks</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-11 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center px-4 shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden mr-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">☰</button>
          <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
            <span className="text-[var(--text-muted)]">Karya ›</span>
            <span className="font-medium text-[var(--text-primary)] truncate">{currentSession?.name || "Chat"}</span>
            {activeAgent && activeAgent.agent !== "supervisor" && (
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-medium border border-purple-500/20">
                {activeAgent.agent === "browser" && "🌐 Browser"}
                {activeAgent.agent === "file" && "📁 File"}
                {activeAgent.agent === "coder" && "💻 Coder"}
                {activeAgent.agent === "researcher" && "🔍 Research"}
                {activeAgent.agent === "data-analyst" && "📊 Data"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                <span className="text-xs text-purple-600 font-medium">
                  {streamingTools.length > 0 ? `Using ${streamingTools[streamingTools.length-1]?.toolName}...` : streamingText ? "Generating..." : "Thinking..."}
                </span>
                <button
                  onClick={() => { abortRef.current?.abort(); setIsLoading(false); setStreamingText(""); setStreamingTools([]); }}
                  className="px-2 py-0.5 rounded text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all font-medium"
                  title="Cancel"
                >
                  ■ Stop
                </button>
              </div>
            )}
            {/* Session switcher dropdown */}
            <select
              value={activeId}
              onChange={(e) => switchSession(e.target.value)}
              className="text-xs bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-secondary)] focus:outline-none focus:border-purple-400 max-w-[140px] truncate"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {/* Clear current chat messages */}
            <button
              onClick={async () => {
                try {
                  await fetch("/api/sessions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "clear", id: activeId }),
                  });
                  setMessages([]);
                } catch {}
              }}
              className="px-2 py-1 rounded-lg text-[10px] text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-hover)] transition-colors"
              title="Clear messages"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
            {/* Delete current chat session */}
            {activeId !== "default" && (
              <button
                onClick={() => delSession(activeId)}
                className="px-2 py-1 rounded-lg text-[10px] text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-hover)] transition-colors"
                title="Delete chat"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
            <button
              onClick={newSession}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-sm"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              New
            </button>
          </div>
        </div>

        {/* Chat */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto bg-[var(--bg-primary)] relative">
          {messages.length === 0 && !streamingText ? (
            <div className="flex flex-col items-center justify-center h-full px-6">
              {/* Hero */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-3xl mb-5 shadow-xl shadow-purple-500/20">⚡</div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">What should I do?</h2>
              <p className="text-sm text-[var(--text-muted)] mb-8 text-center max-w-md">
                I can execute real tasks on your computer — browse the web, manage files, run commands, and more.
              </p>
              
              {/* Quick Actions */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl w-full">
                {[
                  { icon: "💻", text: "System info batao", desc: "OS, CPU, RAM" },
                  { icon: "📁", text: "Desktop files dikhao", desc: "List files" },
                  { icon: "🔍", text: "Web search karo", desc: "DuckDuckGo" },
                  { icon: "🕐", text: "Time kya hai?", desc: "Date & time" },
                  { icon: "📊", text: "Running processes", desc: "Top 10" },
                  { icon: "📋", text: "Clipboard content", desc: "Read clipboard" },
                ].map((ex, i) => (
                  <button 
                    key={i} 
                    onClick={() => quickSend(ex.text)} 
                    className="group text-left p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)] hover:shadow-lg hover:shadow-purple-500/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl group-hover:scale-110 transition-transform">{ex.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{ex.text}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{ex.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Stats */}
              <div className="flex items-center gap-6 mt-8 text-[11px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  73 tools available
                </span>
                <span>•</span>
                <span>9 workflows</span>
                <span>•</span>
                <span>6 skills</span>
              </div>
              
              {/* Shortcuts hint */}
              <div className="flex items-center gap-4 mt-4 text-[10px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <kbd className="bg-[var(--bg-tertiary)] border border-[var(--border)] px-1.5 py-0.5 rounded">Ctrl+K</kbd>
                  Commands
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-[var(--bg-tertiary)] border border-[var(--border)] px-1.5 py-0.5 rounded">Drop</kbd>
                  Files
                </span>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-5 py-5 space-y-4">
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
                        {/* Attached images */}
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
                        {/* Tool count chip (Point 58) */}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <span className="text-[10px] text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-full font-medium">
                            ✦ {msg.toolCalls.length} tool{msg.toolCalls.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div className="pl-8">
                        {msg.toolCalls?.map((t, i) => <ToolCard key={i} toolName={t.toolName} status={t.status === "done" ? "done" : "error"} args={t.args} result={t.result} />)}
                        {msg.content && (
                          <div className="mt-1">
                            <MessageContent content={msg.content} />
                          </div>
                        )}
                        {/* Message actions (Point 64) */}
                        <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5 mt-2 -ml-1">
                          <button onClick={() => navigator.clipboard.writeText(msg.content)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md hover:bg-[var(--bg-secondary)] transition-all" title="Copy">📋 Copy</button>
                          <button onClick={() => quickSend(messages[idx - 1]?.content || "")} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md hover:bg-[var(--bg-secondary)] transition-all" title="Retry">🔄 Retry</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {(streamingTools.length > 0 || streamingText || (isLoading && !streamingText && streamingTools.length === 0)) && (
                <div className="py-3 px-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-[10px] text-white shrink-0">⚡</div>
                    <span className="text-[12px] font-medium text-[var(--text-primary)]">Karya</span>
                    {activeAgent && activeAgent.agent !== "supervisor" && (
                      <span className="px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-medium border border-purple-500/20">
                        {activeAgent.agent === "browser" && "🌐 Browser"}
                        {activeAgent.agent === "file" && "📁 File"}
                        {activeAgent.agent === "coder" && "💻 Coder"}
                        {activeAgent.agent === "researcher" && "🔍 Research"}
                        {activeAgent.agent === "data-analyst" && "📊 Data"}
                      </span>
                    )}
                    {streamingTools.length > 0 && (
                      <span className="text-[10px] text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-full font-medium">
                        ✦ {streamingTools.length} tool{streamingTools.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="pl-8">
                    {streamingTools.map((t, i) => <ToolCard key={i} toolName={t.toolName} status={t.status} args={t.args} result={t.result} />)}
                    {streamingText && (
                      <div className="mt-1">
                        <MessageContent content={streamingText} />
                        <span className="inline-block w-0.5 h-4 bg-purple-500 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
                      </div>
                    )}
                    {isLoading && !streamingText && streamingTools.length === 0 && (
                      <ThinkingIndicator 
                        agent={activeAgent} 
                        currentTool={streamingTools.length > 0 ? streamingTools[streamingTools.length - 1]?.toolName : undefined}
                      />
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Scroll to bottom */}
        {showScrollBtn && (
          <div className="flex justify-center -mt-10 relative z-10">
            <button
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="bg-[var(--bg-secondary)] border border-[var(--border)] shadow-lg rounded-full px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
            >
              ↓ Scroll to bottom
            </button>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] p-3 shrink-0">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            {/* Pending images preview */}
            {pendingImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 px-1">
                {pendingImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={img.preview} alt={img.name} className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => removePendingImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      ×
                    </button>
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center py-0.5 rounded-b-lg truncate px-1">
                      {img.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="chat-input flex items-end gap-3 px-4 py-3">
              {/* Attach button */}
              <label className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors shrink-0 pb-1">
                <input type="file" className="hidden" multiple accept="image/*,.pdf,.txt,.json,.csv,.md" onChange={(e) => e.target.files && handleFileDrop(e.target.files)} />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
              </label>
              
              {/* Input */}
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={pendingImages.length > 0 ? "Describe what you want to know about this image..." : "Message Karya..."}
                rows={1} disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none disabled:opacity-50"
                style={{ minHeight: "24px", maxHeight: "120px" }} />
              
              {/* Keyboard shortcut hint */}
              {!input && !isLoading && (
                <div className="hidden md:flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] shrink-0 pb-1">
                  <kbd className="bg-[var(--bg-tertiary)] border border-[var(--border)] px-1.5 py-0.5 rounded">⌘K</kbd>
                </div>
              )}
              
              {/* Send button */}
              <button type="submit" disabled={isLoading || (!input.trim() && pendingImages.length === 0)}
                className="w-9 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center disabled:opacity-30 transition-all shrink-0 shadow-sm shadow-purple-500/20">
                {isLoading ? <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> :
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
