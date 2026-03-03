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
    <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-card p-5">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="请输入面试题目，例如：你单位要开展一次关于垃圾分类的宣传活动，领导让你负责，你会怎么做？"
        className="min-h-[120px] resize-none border-0 p-0 focus-visible:ring-0 text-sm placeholder:text-zinc-400 text-zinc-700"
        disabled={isGenerating}
      />
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100/60">
        <span className="text-xs text-zinc-400">
          {isGenerating ? (
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-violet-500" />
              <span className="text-violet-600 font-medium">{modelName}</span>
              <span>生成中</span>
              <span className="text-zinc-500">{streamWordCount} 字</span>
            </span>
          ) : (
            "Ctrl+Enter 发送"
          )}
        </span>
        <div className="flex items-center gap-2">
          {isGenerating ? (
            <Button
              onClick={onStop}
              variant="outline"
              size="sm"
              className="gap-1.5 text-red-600 border-red-200/60 hover:bg-red-50/80 rounded-xl"
            >
              <Square className="h-3.5 w-3.5" />
              停止生成
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!text.trim() || disabled}
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 shadow-sm rounded-xl"
            >
              {disabled ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              生成作答
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
