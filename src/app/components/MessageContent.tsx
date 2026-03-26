"use client";

import ReactMarkdown from "react-markdown";

interface MessageContentProps {
  content: string;
}

export default function MessageContent({ content }: MessageContentProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className="block bg-black/30 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          ul: ({ children }) => (
            <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-[var(--text-primary)]">{children}</li>
          ),
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mb-2 mt-3">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold mb-1 mt-2">{children}</h3>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 underline"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-purple-500 pl-3 italic text-[var(--text-secondary)] my-2">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
