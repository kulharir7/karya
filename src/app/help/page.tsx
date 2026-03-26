"use client";
import Link from "next/link";

const TOOLS = [
  { cat: "🌐 Browser", tools: [
    { name: "browser-navigate", desc: "Open any URL" },
    { name: "browser-act", desc: "Click, type, scroll on page" },
    { name: "browser-extract", desc: "Extract data from page" },
    { name: "browser-screenshot", desc: "Capture page screenshot" },
    { name: "web-search", desc: "DuckDuckGo web search" },
    { name: "browser-agent", desc: "Multi-step browser tasks" },
  ]},
  { cat: "📁 Files", tools: [
    { name: "file-read", desc: "Read text file contents" },
    { name: "file-write", desc: "Create or write files" },
    { name: "file-list", desc: "List directory contents" },
    { name: "file-move", desc: "Move or rename files" },
    { name: "file-search", desc: "Find files by name" },
    { name: "file-read-pdf", desc: "Extract PDF text" },
    { name: "file-resize-image", desc: "Resize/compress images" },
    { name: "file-zip", desc: "Create ZIP archives" },
    { name: "file-unzip", desc: "Extract ZIP files" },
    { name: "file-batch-rename", desc: "Bulk rename files" },
    { name: "file-size-info", desc: "Get file/folder sizes" },
  ]},
  { cat: "💻 Shell", tools: [
    { name: "shell-execute", desc: "Run PowerShell commands" },
  ]},
  { cat: "🖥️ System", tools: [
    { name: "system-info", desc: "OS, CPU, RAM info" },
    { name: "system-datetime", desc: "Current date & time" },
    { name: "system-processes", desc: "Running processes" },
    { name: "system-open-app", desc: "Open apps/files/URLs" },
    { name: "system-kill-process", desc: "Kill a process" },
    { name: "clipboard-read", desc: "Read clipboard" },
    { name: "clipboard-write", desc: "Write to clipboard" },
    { name: "system-notify", desc: "Desktop notification" },
  ]},
];

const SHORTCUTS = [
  { key: "Enter", desc: "Send message" },
  { key: "Shift+Enter", desc: "New line" },
  { key: "Ctrl+K", desc: "Command palette" },
  { key: "Drag & Drop", desc: "Upload files" },
];

const EXAMPLES = [
  { q: "System info batao", desc: "Shows OS, CPU, RAM, username" },
  { q: "Desktop pe kya files hain?", desc: "Lists files on Desktop" },
  { q: "Downloads mein PDFs dhundho", desc: "Finds all PDF files" },
  { q: "Chrome kholo", desc: "Opens Chrome browser" },
  { q: "Aaj kya date hai?", desc: "Current date and time" },
  { q: "Clipboard mein kya hai?", desc: "Shows clipboard contents" },
  { q: "F:\\karya folder ka size batao", desc: "Folder size calculation" },
  { q: "Search 'Mastra AI framework'", desc: "Web search" },
  { q: "Desktop pe test.txt banao 'Hello World' likh ke", desc: "Creates a file" },
  { q: "Notepad band karo", desc: "Kills notepad process" },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">← Back</Link>
          <span className="text-gray-300">·</span>
          <h1 className="text-sm font-semibold text-gray-800">Help & Documentation</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        {/* Intro */}
        <section className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xl mx-auto mb-3 shadow-md">⚡</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Karya</h2>
          <p className="text-sm text-gray-500">AI Computer Agent — I execute tasks, not just talk about them</p>
        </section>

        {/* Keyboard Shortcuts */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">⌨️ Keyboard Shortcuts</h3>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {SHORTCUTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-gray-700">{s.desc}</span>
                <kbd className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">{s.key}</kbd>
              </div>
            ))}
          </div>
        </section>

        {/* Examples */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">💡 Example Commands</h3>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {EXAMPLES.map((e) => (
              <div key={e.q} className="px-4 py-2.5">
                <p className="text-sm font-medium text-gray-800">&ldquo;{e.q}&rdquo;</p>
                <p className="text-xs text-gray-400 mt-0.5">{e.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tools */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">🔧 All 26 Tools</h3>
          <div className="space-y-4">
            {TOOLS.map((cat) => (
              <div key={cat.cat}>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">{cat.cat}</h4>
                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {cat.tools.map((t) => (
                    <div key={t.name} className="flex items-center justify-between px-4 py-2">
                      <code className="text-xs font-mono text-purple-600">{t.name}</code>
                      <span className="text-xs text-gray-500">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
