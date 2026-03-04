"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Icon } from "./Icon";

interface SectionEditorProps {
  initialContent: string;
  onSave: (newContent: string) => void;
  onCancel: () => void;
}

export function SectionEditor({ initialContent, onSave, onCancel }: SectionEditorProps) {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = ta.value.length;
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.max(ta.scrollHeight, 120)}px`;
    }
  }, [content]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (content.trim() !== initialContent.trim()) {
          onSave(content);
        }
      }
    },
    [content, initialContent, onSave, onCancel]
  );

  const hasChanges = content.trim() !== initialContent.trim();

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-amber-200 bg-amber-50/30 px-3 py-2.5 text-sm text-zinc-800 leading-relaxed font-mono resize-none focus:outline-none focus:ring-2 focus:ring-amber-300/50 focus:border-amber-300 placeholder:text-zinc-400"
        placeholder="编辑内容..."
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-400">
          Esc 取消 · {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+Enter 保存
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <Icon name="close" size={14} />
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(content)}
            disabled={!hasChanges}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Icon name="check" size={14} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
