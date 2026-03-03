"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold mt-4 mb-2 text-zinc-800">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold mt-3 mb-1.5 text-zinc-800">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-2 mb-1 text-zinc-700">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="my-1.5 leading-relaxed text-zinc-700 text-sm">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-1.5 pl-4 space-y-0.5 list-disc text-sm">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1.5 pl-4 space-y-0.5 list-decimal text-sm">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-zinc-700 leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-zinc-200 pl-3 my-2 text-zinc-500 text-sm">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-zinc-100 text-zinc-700 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`block bg-zinc-50 p-3 rounded-lg text-xs overflow-x-auto ${className}`} {...props}>
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border-collapse border border-zinc-200 text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-left font-semibold text-zinc-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-zinc-200 px-3 py-1.5 text-zinc-600">
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-800">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-zinc-600 not-italic font-medium">{children}</em>
          ),
          hr: () => <hr className="my-3 border-zinc-100" />,
        }}
      />
    </div>
  );
}
