"use client";

import { useMemo } from "react";
import { QAPair, QuestionCategory } from "@/lib/types";
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
import { SectionKey, SectionVersion, Settings } from "@/lib/types";
import { MentorEvalPanel } from "./MentorEvalPanel";

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
  // Annotation / edit / version
  onSectionUpdate?: (sectionKey: SectionKey, newContent: string, source: SectionVersion["source"], instruction?: string) => void;
  onAnnotationAdd?: (sectionKey: SectionKey, content: string) => void;
  onAnnotationDelete?: (sectionKey: SectionKey, annotationId: string) => void;
  onAnnotationUpdate?: (sectionKey: SectionKey, annotationId: string, content: string) => void;
  onVersionRestore?: (sectionKey: SectionKey, versionId: string) => void;
  onImportToBank?: (content: string, category: QuestionCategory | null) => void;
  onSpeakMentorEval?: (text: string) => void;
  settings?: Settings;
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
  onSectionUpdate,
  onAnnotationAdd,
  onAnnotationDelete,
  onAnnotationUpdate,
  onVersionRestore,
  onImportToBank,
  onSpeakMentorEval,
  settings: cardSettings,
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
        <div className="px-3 py-2.5 sm:px-5 sm:py-3 md:px-6 border-b border-zinc-100/60">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              <Icon name="target" size={14} className="text-amber-500" />
              <span className="text-[11px] font-medium text-zinc-400">得分点</span>
            </div>
            <div className="flex items-center gap-1.5">
              {answer.metadata.keyPoints.map((point, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 shrink-0 px-2 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-100/80"
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  {point}
                </span>
              ))}
            </div>
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
            {([
              { key: "answer" as const, title: "考生作答（现场口吻）", icon: "mic", defaultOpen: true },
              { key: "review" as const, title: "作答复盘（10秒速览）", icon: "analytics", defaultOpen: true },
              { key: "template" as const, title: "通用模板（可复用）", icon: "content_copy", defaultOpen: true },
              { key: "pitfalls" as const, title: "踩坑提醒", icon: "warning", defaultOpen: true },
              { key: "notes" as const, title: "注意事项", icon: "push_pin", defaultOpen: true },
            ] as const).map(({ key, title: secTitle, icon: secIcon, defaultOpen: secOpen }) => (
              <AnswerSection
                key={key}
                title={secTitle}
                content={sections[key]}
                icon={secIcon}
                defaultOpen={secOpen}
                sectionKey={key}
                sectionMeta={answer.sectionMeta?.[key]}
                questionContent={question.content}
                settings={cardSettings}
                onSectionUpdate={onSectionUpdate ? (c, s, i) => onSectionUpdate(key, c, s, i) : undefined}
                onAnnotationAdd={onAnnotationAdd ? (c) => onAnnotationAdd(key, c) : undefined}
                onAnnotationDelete={onAnnotationDelete ? (id) => onAnnotationDelete(key, id) : undefined}
                onAnnotationUpdate={onAnnotationUpdate ? (id, c) => onAnnotationUpdate(key, id, c) : undefined}
                onVersionRestore={onVersionRestore ? (vid) => onVersionRestore(key, vid) : undefined}
                {...(key === "answer" ? {
                  ttsStatus,
                  onSpeak,
                  onPause,
                  onResume,
                  onStop,
                  timestamps,
                  currentWordIndex,
                  plainText,
                  voiceName,
                  ttsRate,
                  onSetRate,
                  onSeek,
                  duration,
                  currentTime,
                  cachedVoices,
                  completionInfo,
                  onClearCompletion,
                } : {})}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mentor evaluation */}
      {!isStreaming && hasSections && cardSettings && (
        <div className="px-3 py-3 sm:px-5 sm:py-3 md:px-6 md:py-3 border-t border-zinc-100/60">
          <MentorEvalPanel
            answerId={answer.id}
            questionContent={question.content}
            answerContent={sections.answer}
            settings={cardSettings}
            onSpeakText={onSpeakMentorEval}
          />
        </div>
      )}

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
            {onImportToBank && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-lg h-9 sm:h-10 px-2.5 sm:px-3 text-zinc-500 hover:text-blue-600 hover:border-blue-200"
                onClick={() => onImportToBank(question.content, answer.metadata?.category || question.category)}
              >
                <Icon name="library_add" size={18} />
                <span className="hidden sm:inline">导入题库</span>
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
