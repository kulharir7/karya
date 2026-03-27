"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Copy button for code blocks (Point 63)
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-medium bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-all opacity-0 group-hover/code:opacity-100"
    >
      {copied ? "✓ Copied" : "📋 Copy"}
    </button>
  );
}

// Language label for code blocks
function LangLabel({ lang }: { lang: string }) {
  const names: Record<string, string> = {
    js: "JavaScript", ts: "TypeScript", tsx: "TSX", jsx: "JSX",
    py: "Python", python: "Python", sh: "Shell", bash: "Bash",
    html: "HTML", css: "CSS", json: "JSON", yaml: "YAML",
    sql: "SQL", md: "Markdown", powershell: "PowerShell", ps1: "PowerShell",
    java: "Java", cpp: "C++", c: "C", go: "Go", rust: "Rust",
    ruby: "Ruby", php: "PHP", swift: "Swift", kotlin: "Kotlin",
    dockerfile: "Dockerfile", xml: "XML", toml: "TOML",
  };
  return (
    <span className="absolute top-2 left-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
      {names[lang.toLowerCase()] || lang}
    </span>
  );
}

export default function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 text-[13.5px] leading-[1.7] text-[var(--text-primary)]">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
        em: ({ children }) => <em className="italic text-[var(--text-secondary)]">{children}</em>,
        code: ({ children, className }) => {
          const lang = className?.replace("language-", "") || "";
          if (className?.includes("language-") || (typeof children === "string" && children.includes("\n"))) {
            const text = typeof children === "string" ? children : String(children);
            return (
              <div className="group/code relative my-3 rounded-lg overflow-hidden border border-[var(--border)] bg-[#0d0d12]">
                {lang && <LangLabel lang={lang} />}
                <CopyButton text={text} />
                <pre className={`p-4 ${lang ? "pt-8" : "pt-4"} overflow-x-auto`}>
                  <code className="text-[12px] leading-[1.6] font-mono text-[#e4e4e7]">
                    {children}
                  </code>
                </pre>
              </div>
            );
          }
          return <code className="bg-purple-500/10 text-purple-600 px-1.5 py-0.5 rounded text-[12px] font-mono">{children}</code>;
        },
        pre: ({ children }) => <>{children}</>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1 text-[13.5px]">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-[13.5px]">{children}</ol>,
        li: ({ children }) => <li className="text-[var(--text-primary)] leading-[1.6]">{children}</li>,
        h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-4 text-[var(--text-primary)]">{children}</h1>,
        h2: ({ children }) => <h2 className="text-[14px] font-bold mb-1.5 mt-3 text-[var(--text-primary)]">{children}</h2>,
        h3: ({ children }) => <h3 className="text-[13.5px] font-semibold mb-1 mt-2 text-[var(--text-primary)]">{children}</h3>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-400 underline underline-offset-2 decoration-purple-500/30">{children}</a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-purple-500/40 pl-3 italic text-[var(--text-secondary)] my-2">{children}</blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3 rounded-lg border border-[var(--border)]">
            <table className="w-full text-[12px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">{children}</thead>,
        tr: ({ children }) => <tr className="border-b border-[var(--border)] last:border-0">{children}</tr>,
        th: ({ children }) => <th className="text-left px-3 py-2 font-semibold text-[var(--text-primary)] text-[12px]">{children}</th>,
        td: ({ children }) => <td className="px-3 py-2 text-[var(--text-secondary)] text-[12px]">{children}</td>,
        hr: () => <hr className="border-[var(--border)] my-3" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
