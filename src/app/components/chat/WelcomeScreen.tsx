"use client";

const EXAMPLES = [
  { icon: "💻", text: "System info batao", desc: "OS, CPU, RAM" },
  { icon: "📁", text: "Desktop files dikhao", desc: "List files" },
  { icon: "🔍", text: "Web search karo", desc: "DuckDuckGo" },
  { icon: "🕐", text: "Time kya hai?", desc: "Date & time" },
  { icon: "📊", text: "Running processes", desc: "Top 10" },
  { icon: "📋", text: "Clipboard content", desc: "Read clipboard" },
];

export default function WelcomeScreen({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-3xl mb-5 shadow-xl shadow-purple-500/20">⚡</div>
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">What should I do?</h2>
      <p className="text-sm text-[var(--text-muted)] mb-8 text-center max-w-md">
        I can execute real tasks on your computer — browse the web, manage files, run commands, and more.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl w-full">
        {EXAMPLES.map((ex, i) => (
          <button key={i} onClick={() => onSend(ex.text)}
            className="group text-left p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)] hover:shadow-lg hover:shadow-purple-500/5 transition-all">
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

      <div className="flex items-center gap-6 mt-8 text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />82 tools</span>
        <span>•</span><span>9 workflows</span>
        <span>•</span><span>3 plugins</span>
      </div>

      <div className="flex items-center gap-4 mt-4 text-[10px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1"><kbd className="bg-[var(--bg-tertiary)] border border-[var(--border)] px-1.5 py-0.5 rounded">Ctrl+K</kbd> Commands</span>
        <span className="flex items-center gap-1"><kbd className="bg-[var(--bg-tertiary)] border border-[var(--border)] px-1.5 py-0.5 rounded">Drop</kbd> Files</span>
      </div>
    </div>
  );
}
