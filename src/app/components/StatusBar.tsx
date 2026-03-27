"use client";

import { useState, useEffect } from "react";

interface StatusBarProps {
  model?: string;
  isConnected?: boolean;
  taskCount?: number;
}

export default function StatusBar({ model = "gpt-oss:120b", isConnected = true, taskCount = 0 }: StatusBarProps) {
  const [time, setTime] = useState<string>("");
  
  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--bg-tertiary)] border-t border-[var(--border)] text-[10px]">
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 shadow-sm shadow-green-500/50" : "bg-red-500"}`} />
          <span className="text-[var(--text-muted)]">{isConnected ? "Connected" : "Disconnected"}</span>
        </div>
        
        {/* Model */}
        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
          <span>🤖</span>
          <span>{model}</span>
        </div>
        
        {/* Tasks */}
        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
          <span>⏰</span>
          <span>{taskCount} tasks</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Time */}
        <span className="text-[var(--text-muted)] font-mono">{time}</span>
        
        {/* Shortcuts hint */}
        <div className="hidden md:flex items-center gap-2 text-[var(--text-muted)]">
          <span>⌨️</span>
          <span>Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
