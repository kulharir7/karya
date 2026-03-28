"use client";

import { useState, useCallback, useRef } from "react";

// ============================================
// TYPES
// ============================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  images?: string[];
}

export interface ToolCall {
  toolName: string;
  args?: any;
  result?: any;
  status: "running" | "done" | "error";
}

export interface AgentInfo {
  agent: string;
  confidence: number;
  reason: string;
}

export interface ImageAttachment {
  base64: string;
  mimeType: string;
  name: string;
  preview: string;
}

// ============================================
// HOOK
// ============================================

export function useChat(opts: {
  sessionId: string;
  apiUrl?: string;
  onSessionChange?: (newId: string) => void;
  onSessionsReload?: () => void;
}) {
  const { sessionId, apiUrl = "/api/chat", onSessionChange, onSessionsReload } = opts;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streamingTools, setStreamingTools] = useState<ToolCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ---- Load messages from server ----
  const loadMessages = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/sessions?id=${sid}&limit=100`);
      const data = await res.json();
      if (data.messages) {
        setMessages(
          data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            toolCalls: m.toolCalls,
          }))
        );
      }
    } catch {}
  }, []);

  // ---- Core: Send message + stream response (ONE implementation) ----
  const sendMessage = useCallback(
    async (text: string, images?: ImageAttachment[]) => {
      if (isLoading) return;
      if (!text.trim() && (!images || images.length === 0)) return;

      // Add user message locally
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim() || (images?.length ? "[Image attached]" : ""),
        timestamp: Date.now(),
        images: images?.map((img) => img.preview),
      };
      setMessages((prev) => [...prev, userMsg]);

      const msgText = text.trim() || "What's in this image?";
      const imagesToSend = images?.map((img) => ({
        base64: img.base64,
        mimeType: img.mimeType,
        name: img.name,
      }));

      setIsLoading(true);
      setStreamingText("");
      setStreamingTools([]);
      setActiveAgent(null);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msgText,
            sessionId,
            images: imagesToSend?.length ? imagesToSend : undefined,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) throw new Error("Server error");

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";
        const tools: ToolCall[] = [];

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

              if (d.type === "text-delta" || d.type === "text") {
                fullText += d.content;
                setStreamingText(fullText);
              } else if (d.type === "session" && d.sessionId && d.sessionId !== sessionId) {
                onSessionChange?.(d.sessionId);
              } else if (d.type === "agent-route") {
                setActiveAgent({ agent: d.agent, confidence: d.confidence, reason: d.reason });
              } else if (d.type === "tool-call") {
                tools.push({ toolName: d.toolName, args: d.args, status: "running" });
                setStreamingTools([...tools]);
              } else if (d.type === "tool-approval") {
                // Tool requires approval — show as "pending" in UI
                tools.push({ toolName: d.toolName, args: d.args, status: "running" });
                setStreamingTools([...tools]);
                // TODO: Show approval dialog, send approve/decline response
              } else if (d.type === "tool-result") {
                const i = tools.findIndex((t) => t.toolName === d.toolName && t.status === "running");
                if (i !== -1) {
                  tools[i].result = d.result;
                  tools[i].status = "done";
                }
                setStreamingTools([...tools]);
              } else if (d.type === "error") {
                fullText += `\n❌ ${d.content}`;
                setStreamingText(fullText);
              }
            } catch {}
          }
        }

        // Add assistant message
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: fullText || "✅ Done.",
            timestamp: Date.now(),
            toolCalls: tools.length > 0 ? tools.map((t) => ({ ...t })) : undefined,
          },
        ]);

        setStreamingText("");
        setStreamingTools([]);
        setActiveAgent(null);
        onSessionsReload?.();
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: `❌ ${err.message}`,
              timestamp: Date.now(),
            },
          ]);
        }
        setStreamingText("");
        setStreamingTools([]);
        setActiveAgent(null);
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [isLoading, sessionId, apiUrl, onSessionChange, onSessionsReload]
  );

  // ---- Cancel ----
  const cancelRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setIsLoading(false);
      setStreamingText("");
      setStreamingTools([]);
      setActiveAgent(null);
    }
  }, []);

  // ---- Clear ----
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    setMessages,
    streamingText,
    streamingTools,
    isLoading,
    activeAgent,
    sendMessage,
    cancelRequest,
    loadMessages,
    clearMessages,
  };
}
