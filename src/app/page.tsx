"use client";

import { useState, useEffect, useCallback } from "react";
import { useChat } from "./hooks/useChat";
import Sidebar from "./components/sidebar/Sidebar";
import Header from "./components/layout/Header";
import ChatContainer from "./components/chat/ChatContainer";
import ChatInput from "./components/chat/ChatInput";
import CommandPalette from "./components/CommandPalette";

// ============================================
// TYPES
// ============================================

interface Session { id: string; name: string; createdAt: number; updatedAt: number; messageCount: number; }

// ============================================
// MAIN PAGE
// ============================================

export default function Home() {
  // ---- State ----
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState("default");
  const [taskCount, setTaskCount] = useState(0);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ---- Chat hook (replaces all SSE logic) ----
  const {
    messages, streamingText, streamingTools, isLoading, activeAgent,
    sendMessage, cancelRequest, loadMessages, clearMessages,
  } = useChat({
    sessionId: activeId,
    onSessionChange: (newId) => {
      setActiveId(newId);
      localStorage.setItem("karya-active-session", newId);
    },
    onSessionsReload: () => loadSessions(),
  });

  // ---- Session management ----
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {}
  }, []);

  const switchSession = useCallback(async (id: string) => {
    setActiveId(id);
    localStorage.setItem("karya-active-session", id);
    await loadMessages(id);
  }, [loadMessages]);

  const newSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create" }) });
      const data = await res.json();
      if (data.success && data.session) {
        setActiveId(data.session.id);
        localStorage.setItem("karya-active-session", data.session.id);
        clearMessages();
        await loadSessions();
      }
    } catch {}
  }, [loadSessions, clearMessages]);

  const delSession = useCallback(async (id: string) => {
    try {
      await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
      await loadSessions();
      if (id === activeId) { setActiveId("default"); localStorage.setItem("karya-active-session", "default"); await loadMessages("default"); }
    } catch {}
  }, [activeId, loadSessions, loadMessages]);

  const clearChat = useCallback(async () => {
    try {
      await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear", id: activeId }) });
      clearMessages();
    } catch {}
  }, [activeId, clearMessages]);

  // ---- Dark mode ----
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

  // ---- Init ----
  useEffect(() => {
    loadSessions();
    const savedActive = localStorage.getItem("karya-active-session") || "default";
    setActiveId(savedActive);
    loadMessages(savedActive);
  }, [loadSessions, loadMessages]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setCmdOpen((v) => !v); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---- Helpers ----
  const currentSession = sessions.find((s) => s.id === activeId);
  const handleSend = (text: string, images?: any[]) => { setTaskCount((c) => c + 1); sendMessage(text, images); };
  const exportChat = () => {
    const text = messages.map((m) => `[${m.role === "user" ? "You" : "Karya"}]\n${m.content}`).join("\n\n---\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `karya-chat-${new Date().toISOString().slice(0, 10)}.txt`; a.click();
  };

  // ---- Render ----
  return (
    <div className="flex h-screen bg-[var(--bg-primary)]"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); }}>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onSelect={(a) => { handleSend(a); setCmdOpen(false); }} />

      {dragging && (
        <div className="fixed inset-0 z-40 bg-purple-500/10 border-2 border-dashed border-purple-400 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl shadow-lg px-8 py-6 text-center">
            <p className="text-3xl mb-2">📎</p>
            <p className="text-sm font-medium text-gray-800">Drop files here</p>
          </div>
        </div>
      )}

      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <Sidebar
        sessions={sessions} activeId={activeId} dark={dark} taskCount={taskCount} sidebarOpen={sidebarOpen}
        onToggleDark={toggleDark} onNewSession={newSession} onSwitchSession={switchSession}
        onDeleteSession={delSession} onOpenCommand={() => setCmdOpen(true)} onExportChat={exportChat}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          sessions={sessions} activeId={activeId} currentSession={currentSession}
          isLoading={isLoading} streamingTools={streamingTools} streamingText={streamingText}
          activeAgent={activeAgent} sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} onSwitchSession={switchSession}
          onNewSession={newSession} onClearChat={clearChat}
          onDeleteSession={() => delSession(activeId)} onCancelRequest={cancelRequest}
        />

        <ChatContainer
          messages={messages} streamingText={streamingText} streamingTools={streamingTools}
          isLoading={isLoading} activeAgent={activeAgent} onQuickSend={handleSend}
        />

        <ChatInput isLoading={isLoading} onSend={handleSend} onCancel={cancelRequest} />
      </div>
    </div>
  );
}
