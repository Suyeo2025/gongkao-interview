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
  accentColor?: string;
  bgColor?: string;
}

export function AnswerSection({
  title,
  content,
  defaultOpen = true,
  icon = "",
  accentColor = "border-l-violet-500",
  bgColor = "",
}: AnswerSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!content.trim()) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`rounded-lg sm:rounded-xl overflow-hidden border-l-4 ${accentColor} ${bgColor || "bg-white"}`}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-3 sm:px-4 sm:py-3.5 md:px-5 hover:bg-black/[0.02] transition-colors min-h-[44px]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {open ? (
              <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
            )}
            {icon && <span className="text-base shrink-0">{icon}</span>}
            <span className="font-semibold text-sm text-zinc-800 truncate">
              {title}
            </span>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 ml-2">
            <CopyButton text={content} variant="ghost" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4 md:px-5 md:pb-5">
            <MarkdownRenderer content={content} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
