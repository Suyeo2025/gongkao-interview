"use client";

import { useState } from "react";
import { SectionVersion } from "@/lib/types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Icon } from "./Icon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionTitle: string;
  versions: SectionVersion[];
  currentVersionId: string;
  onRestore: (versionId: string) => void;
}

const SOURCE_LABELS: Record<SectionVersion["source"], { label: string; color: string; icon: string }> = {
  ai_original:   { label: "AI 原版",    color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "auto_awesome" },
  manual_edit:   { label: "手动编辑",   color: "bg-amber-50 text-amber-700 border-amber-200",       icon: "edit_note" },
  ai_regenerate: { label: "AI 重写",    color: "bg-purple-50 text-purple-700 border-purple-200",    icon: "auto_fix_high" },
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  sectionTitle,
  versions,
  currentVersionId,
  onRestore,
}: VersionHistoryDialogProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = versions[selectedIdx];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon name="history" size={18} className="text-blue-500" />
            版本历史 - {sectionTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col sm:flex-row gap-3 min-h-0 overflow-hidden">
          {/* Timeline */}
          <div className="sm:w-48 shrink-0 overflow-y-auto space-y-1 sm:border-r sm:border-zinc-100 sm:pr-3">
            {versions.map((ver, idx) => {
              const info = SOURCE_LABELS[ver.source];
              const isCurrent = ver.id === currentVersionId;
              const isSelected = idx === selectedIdx;
              return (
                <button
                  key={ver.id}
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${
                    isSelected
                      ? "bg-blue-50 border border-blue-200"
                      : "hover:bg-zinc-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${info.color}`}>
                      <Icon name={info.icon} size={10} />
                      {info.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] text-blue-600 font-medium">当前</span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1">{formatTime(ver.createdAt)}</div>
                  {ver.instruction && (
                    <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2 italic">
                      &ldquo;{ver.instruction}&rdquo;
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Preview */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
              {selected && <MarkdownRenderer content={selected.content} />}
            </div>

            {/* Restore button */}
            {selected && selected.id !== currentVersionId && (
              <button
                type="button"
                onClick={() => onRestore(selected.id)}
                className="mt-2 w-full sm:w-auto sm:self-end inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors"
              >
                <Icon name="restore" size={14} />
                恢复此版本
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
