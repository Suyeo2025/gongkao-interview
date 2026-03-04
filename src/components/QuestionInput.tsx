"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Icon } from "./Icon";
import { Button } from "@/components/ui/button";

interface QuestionInputProps {
  onSubmit: (question: string) => void;
  onStop?: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  modelName?: string;
  streamWordCount?: number;
}

export function QuestionInput({
  onSubmit,
  onStop,
  isGenerating,
  disabled = false,
  modelName,
  streamWordCount = 0,
}: QuestionInputProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.max(ta.scrollHeight, 56)}px`;
    }
  }, [text]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isGenerating) return;
    onSubmit(trimmed);
    setText("");
  }, [text, isGenerating, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const hasText = text.trim().length > 0;

  return (
    <div
      className={`relative bg-white rounded-2xl border transition-all duration-200 ${
        focused
          ? "border-amber-300 shadow-lg shadow-amber-100/50 ring-1 ring-amber-200/50"
          : "border-zinc-200/60 shadow-card"
      }`}
    >
      {/* Textarea area */}
      <div className="px-3.5 pt-3.5 pb-1 sm:px-5 sm:pt-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="输入面试题目..."
          className="w-full resize-none border-0 p-0 text-sm sm:text-[15px] leading-relaxed text-zinc-800 placeholder:text-zinc-300 focus:outline-none bg-transparent"
          style={{ minHeight: "56px", maxHeight: "200px" }}
          disabled={isGenerating}
          rows={1}
        />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-3 pb-3 sm:px-4 sm:pb-3.5">
        <div className="text-[11px] text-zinc-300 flex items-center gap-2">
          {isGenerating ? (
            <span className="inline-flex items-center gap-1.5 text-amber-600">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
              </span>
              <span className="font-medium truncate max-w-[100px]">{modelName}</span>
              <span className="text-zinc-400">{streamWordCount} 字</span>
            </span>
          ) : (
            <>
              <span className="hidden sm:inline">{navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+Enter</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isGenerating ? (
            <Button
              onClick={onStop}
              variant="ghost"
              size="sm"
              className="gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg h-8 px-2.5 text-xs"
            >
              <Icon name="stop" size={16} />
              停止
            </Button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasText || disabled}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                hasText && !disabled
                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-300 cursor-not-allowed"
              }`}
            >
              {disabled ? (
                <Icon name="progress_activity" size={16} className="animate-spin" />
              ) : (
                <Icon name="arrow_upward" size={18} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
