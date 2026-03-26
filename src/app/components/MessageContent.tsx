"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageContentProps {
  content: string;
}

export default function MessageContent({ content }: MessageContentProps) {
  return (
    <div className="karya-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed text-sm">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-purple-300">{children}</em>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className="block bg-black/40 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2 text-green-300">
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
            <ul className="list-disc pl-5 mb-2 space-y-1 text-sm">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-2 space-y-1 text-sm">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-[var(--text-primary)]">{children}</li>
          ),
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mb-2 mt-3 text-white">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mb-2 mt-3 text-white">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold mb-1 mt-2 text-white">{children}</h3>
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
          // Table support
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="w-full text-xs border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-[var(--border)]">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-[var(--border)] last:border-0">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="text-left px-3 py-2 font-semibold text-purple-300 bg-purple-500/10">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-[var(--text-primary)]">{children}</td>
          ),
          hr: () => <hr className="border-[var(--border)] my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
