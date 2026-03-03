"use client";

import { useState, useCallback } from "react";
import { Send, Square, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-zinc-200/60 shadow-card p-3 sm:p-4 md:p-5">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="请输入面试题目，例如：关于垃圾分类的宣传活动..."
        className="min-h-[80px] sm:min-h-[100px] md:min-h-[120px] resize-none border-0 p-0 focus-visible:ring-0 text-sm placeholder:text-zinc-400 text-zinc-700"
        disabled={isGenerating}
      />
      <div className="flex items-center justify-between mt-3 pt-3 sm:mt-4 sm:pt-4 border-t border-zinc-100/60">
        <span className="text-xs text-zinc-400 min-w-0 flex-1 mr-2">
          {isGenerating ? (
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" />
              <span className="text-violet-600 font-medium truncate max-w-[80px] sm:max-w-none">{modelName}</span>
              <span className="shrink-0">生成中</span>
              <span className="text-zinc-500 shrink-0">{streamWordCount} 字</span>
            </span>
          ) : (
            <span className="hidden sm:inline">Ctrl+Enter 发送</span>
          )}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {isGenerating ? (
            <Button
              onClick={onStop}
              variant="outline"
              className="gap-1.5 text-red-600 border-red-200/60 hover:bg-red-50/80 rounded-xl h-10 px-4 text-sm"
            >
              <Square className="h-4 w-4" />
              停止
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!text.trim() || disabled}
              className="gap-1.5 bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 shadow-sm rounded-xl h-10 px-4 text-sm"
            >
              {disabled ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">生成作答</span>
              <span className="sm:hidden">生成</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
