"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { CopyButton } from "./CopyButton";

interface AnswerSectionProps {
  title: string;
  content: string;
  defaultOpen?: boolean;
  icon?: string;
}

export function AnswerSection({
  title,
  content,
  defaultOpen = true,
  icon = "",
}: AnswerSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!content.trim()) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-b border-zinc-100 last:border-b-0">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-0 py-3 sm:py-3.5 hover:bg-transparent transition-colors min-h-[44px] group">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {icon && <span className="text-base shrink-0">{icon}</span>}
            <span className="font-semibold text-sm text-zinc-800 truncate">
              {title}
            </span>
            {open ? (
              <ChevronDown className="h-4 w-4 text-zinc-300 shrink-0 group-hover:text-zinc-500 transition-colors" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-300 shrink-0 group-hover:text-zinc-500 transition-colors" />
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 ml-2">
            <CopyButton text={content} variant="ghost" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pb-4 sm:pb-5">
            <MarkdownRenderer content={content} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
