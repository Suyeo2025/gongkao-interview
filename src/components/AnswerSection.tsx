"use client";

import { MarkdownRenderer } from "./MarkdownRenderer";
import { CopyButton } from "./CopyButton";

interface AnswerSectionProps {
  title: string;
  content: string;
  icon?: string;
}

export function AnswerSection({
  title,
  content,
  icon = "",
}: AnswerSectionProps) {
  if (!content.trim()) return null;

  return (
    <div className="py-3 sm:py-4 border-b border-zinc-100/80 last:border-b-0">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="text-base shrink-0">{icon}</span>}
          <span className="font-semibold text-sm text-zinc-800 truncate">
            {title}
          </span>
        </div>
        <div className="shrink-0 ml-2">
          <CopyButton text={content} variant="ghost" />
        </div>
      </div>
      {/* Section content — always visible */}
      <MarkdownRenderer content={content} />
    </div>
  );
}
