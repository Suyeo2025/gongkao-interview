"use client";

import { useState, useRef, useCallback } from "react";
import { SectionKey, Settings, AnswerSections } from "@/lib/types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Icon } from "./Icon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SectionRegenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionTitle: string;
  sectionKey: SectionKey;
  currentContent: string;
  questionContent: string;
  allSections?: AnswerSections;
  settings: Settings;
  onRegenerated: (newContent: string) => void;
}

export function SectionRegenerateDialog({
  open,
  onOpenChange,
  sectionTitle,
  sectionKey,
  currentContent,
  questionContent,
  allSections,
  settings,
  onRegenerated,
}: SectionRegenerateDialogProps) {
  const [instruction, setInstruction] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!instruction.trim()) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);
    setStreamText("");
    setError(null);
    setShowPreview(true);

    try {
      const res = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionContent,
          sectionKey,
          currentContent,
          allSections,
          instruction: instruction.trim(),
          provider: settings.textProvider,
          apiKey: settings.textProvider === "gemini" ? settings.geminiApiKey : settings.qwenApiKey,
          config: {
            modelName: settings.modelName,
            temperature: settings.temperature,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "请求失败" }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamText(fullText);
      }

      setIsGenerating(false);
      abortRef.current = null;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setIsGenerating(false);
        return;
      }
      const message = err instanceof Error ? err.message : "生成失败";
      setError(message);
      setIsGenerating(false);
    }
  }, [instruction, questionContent, sectionKey, currentContent, settings]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
  }, []);

  const handleAdopt = useCallback(() => {
    if (streamText.trim()) {
      onRegenerated(streamText.trim());
    }
  }, [streamText, onRegenerated]);

  const handleClose = useCallback(
    (v: boolean) => {
      if (isGenerating) {
        handleStop();
      }
      setShowPreview(false);
      setStreamText("");
      setInstruction("");
      setError(null);
      onOpenChange(v);
    },
    [isGenerating, handleStop, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon name="auto_awesome" size={18} className="text-amber-500" />
            AI 重新生成 - {sectionTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
          {/* Instruction input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">修改要求</label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="例如：更简洁一些、加入具体案例、语气更自然..."
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 placeholder:text-zinc-400"
              rows={3}
              disabled={isGenerating}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isGenerating ? (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <Icon name="stop" size={14} />
                停止
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!instruction.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Icon name="auto_awesome" size={14} />
                生成
              </button>
            )}
            {streamText && !isGenerating && (
              <button
                type="button"
                onClick={handleAdopt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-colors"
              >
                <Icon name="check" size={14} />
                采用此版本
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200/60 p-2.5 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Stream preview */}
          {showPreview && (
            <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
              {streamText ? (
                <div className="relative">
                  <MarkdownRenderer content={streamText} />
                  {isGenerating && (
                    <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                  )}
                </div>
              ) : isGenerating ? (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Icon name="progress_activity" size={14} className="animate-spin" />
                  正在生成...
                </div>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
