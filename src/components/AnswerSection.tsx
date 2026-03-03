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
      <div className={`rounded-xl overflow-hidden border-l-4 ${accentColor} ${bgColor || "bg-white"}`}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-5 py-3.5 hover:bg-black/[0.02] transition-colors">
          <div className="flex items-center gap-2.5">
            {open ? (
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            )}
            {icon && <span className="text-base">{icon}</span>}
            <span className="font-semibold text-sm text-zinc-800">
              {title}
            </span>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <CopyButton text={content} label="复制" variant="outline" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-5 pt-0">
            <MarkdownRenderer content={content} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
