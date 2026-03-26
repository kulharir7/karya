"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 text-sm leading-relaxed text-gray-800">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
        em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
        code: ({ children, className }) => {
          if (className?.includes("language-")) {
            return <code className="block bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto my-2 text-gray-700">{children}</code>;
          }
          return <code className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>;
        },
        pre: ({ children }) => <pre className="my-2">{children}</pre>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5 text-sm">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5 text-sm">{children}</ol>,
        li: ({ children }) => <li className="text-gray-700">{children}</li>,
        h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 text-gray-900">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-2 text-gray-900">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 text-gray-800">{children}</h3>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 underline">{children}</a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-purple-400 pl-3 italic text-gray-500 my-2">{children}</blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2"><table className="w-full text-xs border border-gray-200 rounded-md overflow-hidden">{children}</table></div>
        ),
        thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
        tr: ({ children }) => <tr className="border-b border-gray-100">{children}</tr>,
        th: ({ children }) => <th className="text-left px-3 py-2 font-semibold text-gray-700 text-xs">{children}</th>,
        td: ({ children }) => <td className="px-3 py-1.5 text-gray-600 text-xs">{children}</td>,
        hr: () => <hr className="border-gray-200 my-3" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
