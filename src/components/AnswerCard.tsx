"use client";

import { useMemo } from "react";
import { QAPair } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { CopyButton } from "./CopyButton";
import { AnswerSection } from "./AnswerSection";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Badge } from "@/components/ui/badge";
import { Icon } from "./Icon";
import { Button } from "@/components/ui/button";
import { stripMetaBlock, parseSections } from "@/lib/parser";
import { TTSStatus, CompletionInfo } from "@/hooks/useTTS";
import { WordTimestamp, CachedVoiceInfo } from "@/lib/audio-cache";

interface AnswerCardProps {
  pair: QAPair;
  isStreaming?: boolean;
  streamText?: string;
  onToggleFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
  // TTS
  ttsStatus?: TTSStatus;
  onSpeak?: (voice?: string, model?: string, voiceName?: string) => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  timestamps?: WordTimestamp[];
  currentWordIndex?: number;
  plainText?: string;
  // TTS controls
  voiceName?: string;
  ttsRate?: number;
  onSetRate?: (rate: number) => void;
  onSeek?: (time: number) => void;
  duration?: number;
  currentTime?: number;
  cachedVoices?: CachedVoiceInfo[];
  // Completion
  completionInfo?: CompletionInfo | null;
  onClearCompletion?: () => void;
}

export function AnswerCard({
  pair,
  isStreaming = false,
  streamText = "",
  onToggleFavorite,
  onDelete,
  ttsStatus,
  onSpeak,
  onPause,
  onResume,
  onStop,
  timestamps = [],
  currentWordIndex = -1,
  plainText = "",
  voiceName,
  ttsRate = 1,
  onSetRate,
  onSeek,
  duration = 0,
  currentTime = 0,
  cachedVoices,
  completionInfo,
  onClearCompletion,
}: AnswerCardProps) {
  const { question, answer } = pair;
  const displayRaw = isStreaming ? streamText : stripMetaBlock(answer.rawMarkdown);

  // Re-parse sections from rawMarkdown to ensure content is always available
  const sections = useMemo(() => {
    if (isStreaming) return answer.sections;
    // Use stored sections if they have content, otherwise re-parse from raw
    const stored = answer.sections;
    const hasStoredContent =
      stored.answer.trim() || stored.review.trim() || stored.template.trim() ||
      stored.pitfalls.trim() || stored.notes.trim();
    return hasStoredContent ? stored : parseSections(answer.rawMarkdown);
  }, [isStreaming, answer.sections, answer.rawMarkdown]);

  const hasSections =
    !isStreaming &&
    (sections.answer.trim() ||
      sections.review.trim() ||
      sections.template.trim() ||
      sections.pitfalls.trim() ||
      sections.notes.trim());

  const wordCount = isStreaming ? streamText.length : (answer.metadata?.wordCount ?? displayRaw.length);

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-zinc-200/40 shadow-card overflow-hidden">

      {/* Question area */}
      <div className="px-3 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5 border-b border-zinc-100/60">
        {/* Tags row */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 flex-wrap">
          <span className="text-xs font-mono text-zinc-400">{question.id}</span>
          {answer.metadata?.category && (
            <CategoryBadge category={answer.metadata.category} size="sm" />
          )}
          {answer.metadata?.difficulty && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 border-zinc-200 text-zinc-500">
              {answer.metadata.difficulty}
            </Badge>
          )}
        </div>

        {/* Question content */}
        <p className="text-sm text-zinc-800 leading-relaxed font-medium">
          {question.content}
        </p>

        {/* Model badge + status */}
        <div className="flex items-center gap-2 sm:gap-3 mt-2.5 sm:mt-3 text-xs text-zinc-400 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium">
            <Icon name="auto_awesome" size={14} />
            <span className="truncate max-w-[120px] sm:max-w-none">{answer.modelUsed}</span>
          </span>

          {isStreaming ? (
            <>
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                正在生成
              </span>
              <span>{wordCount} 字</span>
            </>
          ) : (
            <>
              {answer.metadata && (
                <>
                  <span className="flex items-center gap-1">
                    <Icon name="description" size={14} />
                    {answer.metadata.wordCount} 字
                  </span>
                  <span className="flex items-center gap-1">
                    <Icon name="schedule" size={14} />
                    {answer.metadata.estimatedTime}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Key points highlight */}
      {answer.metadata?.keyPoints && answer.metadata.keyPoints.length > 0 && !isStreaming && (
        <div className="px-3 py-3 sm:px-5 sm:py-4 md:px-6 bg-gradient-to-r from-amber-50/80 to-amber-50/30 border-b border-amber-100/40">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="emoji_events" size={16} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-800 tracking-wide">核心得分点</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {answer.metadata.keyPoints.map((point, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/70 border border-amber-100/60"
              >
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs text-stone-700 font-medium leading-tight">{point}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="p-3 sm:p-5 md:p-6">
        {isStreaming || !hasSections ? (
          <div className="relative">
            <MarkdownRenderer content={displayRaw} />
            {isStreaming && (
              <span className="inline-block w-2.5 h-5 bg-gradient-to-t from-amber-500 to-amber-400 animate-pulse ml-1 align-text-bottom rounded-sm" />
            )}
          </div>
        ) : (
          <div>
            <AnswerSection
              title="考生作答（现场口吻）"
              content={sections.answer}
              icon="🎙️"
              ttsStatus={ttsStatus}
              onSpeak={onSpeak}
              onPause={onPause}
              onResume={onResume}
              onStop={onStop}
              timestamps={timestamps}
              currentWordIndex={currentWordIndex}
              plainText={plainText}
              voiceName={voiceName}
              ttsRate={ttsRate}
              onSetRate={onSetRate}
              onSeek={onSeek}
              duration={duration}
              currentTime={currentTime}
              cachedVoices={cachedVoices}
              completionInfo={completionInfo}
              onClearCompletion={onClearCompletion}
            />
            <AnswerSection
              title="作答复盘（10秒速览）"
              content={sections.review}
              icon="📊"
            />
            <AnswerSection
              title="通用模板（可复用）"
              content={sections.template}
              icon="📋"
            />
            <AnswerSection
              title="踩坑提醒"
              content={sections.pitfalls}
              icon="⚠️"
            />
            <AnswerSection
              title="注意事项"
              content={sections.notes}
              icon="📌"
            />
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {!isStreaming && (
        <div className="px-3 py-3 sm:px-5 sm:py-3.5 md:px-6 md:py-4 border-t border-zinc-100/60 bg-zinc-50/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {onToggleFavorite && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-lg h-9 sm:h-10 px-2.5 sm:px-3"
                onClick={() => onToggleFavorite(question.id)}
              >
                <Icon
                  name="star"
                  size={18}
                  fill={question.isFavorite}
                  className={question.isFavorite ? "text-amber-400" : "text-zinc-400"}
                />
                <span className="hidden sm:inline">{question.isFavorite ? "已收藏" : "收藏"}</span>
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-lg h-9 sm:h-10 px-2.5 sm:px-3 text-zinc-500 hover:text-red-600 hover:border-red-200"
                onClick={() => onDelete(question.id)}
              >
                <Icon name="delete" size={18} />
                <span className="hidden sm:inline">删除</span>
              </Button>
            )}
          </div>
          <CopyButton
            text={displayRaw}
            label="复制全部"
            variant="outline"
          />
        </div>
      )}
    </div>
  );
}
