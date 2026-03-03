"use client";

import { QAPair } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { CopyButton } from "./CopyButton";
import { AnswerSection } from "./AnswerSection";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, Clock, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stripMetaBlock } from "@/lib/parser";

interface AnswerCardProps {
  pair: QAPair;
  isStreaming?: boolean;
  streamText?: string;
  onToggleFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function AnswerCard({
  pair,
  isStreaming = false,
  streamText = "",
  onToggleFavorite,
  onDelete,
}: AnswerCardProps) {
  const { question, answer } = pair;
  const displayRaw = isStreaming ? streamText : stripMetaBlock(answer.rawMarkdown);

  const hasSections =
    !isStreaming &&
    (answer.sections.answer ||
      answer.sections.review ||
      answer.sections.template ||
      answer.sections.pitfalls ||
      answer.sections.notes);

  const wordCount = isStreaming ? streamText.length : (answer.metadata?.wordCount ?? displayRaw.length);

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/40 shadow-card overflow-hidden">

      {/* ── 题目区 ── */}
      <div className="px-6 py-5 border-b border-zinc-100/60">
        {/* 标签行 */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs font-mono text-zinc-400">{question.id}</span>
          {answer.metadata?.category && (
            <CategoryBadge category={answer.metadata.category} size="sm" />
          )}
          {answer.metadata?.difficulty && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-200 text-zinc-500">
              {answer.metadata.difficulty}
            </Badge>
          )}
        </div>

        {/* 题目内容 */}
        <p className="text-sm text-zinc-800 leading-relaxed font-medium">
          {question.content}
        </p>

        {/* 模型徽章 + 状态 — 始终可见 */}
        <div className="flex items-center gap-3 mt-3 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-violet-50 text-violet-600 font-medium">
            <Sparkles className="h-3 w-3" />
            {answer.modelUsed}
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
                    <FileText className="h-3 w-3" />
                    {answer.metadata.wordCount} 字
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {answer.metadata.estimatedTime}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 得分点高亮区 ── */}
      {answer.metadata?.keyPoints && answer.metadata.keyPoints.length > 0 && !isStreaming && (
        <div className="px-6 py-3 bg-violet-50/50 border-b border-zinc-100/60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-violet-700">得分点</span>
            {answer.metadata.keyPoints.map((point, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700"
              >
                {point}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── 正文区 ── */}
      <div className="p-6">
        {isStreaming || !hasSections ? (
          /* 流式输出 or 原始 Markdown 回退 */
          <div className="relative">
            <MarkdownRenderer content={displayRaw} />
            {isStreaming && (
              <span className="inline-block w-2.5 h-5 bg-gradient-to-t from-violet-500 to-violet-400 animate-pulse ml-1 align-text-bottom rounded-sm" />
            )}
          </div>
        ) : (
          /* 五板块结构化展示 */
          <div className="space-y-4">
            <AnswerSection
              title="考生作答（现场口吻）"
              content={answer.sections.answer}
              defaultOpen={true}
              icon="🎙️"
              accentColor="border-l-violet-500"
              bgColor="bg-white"
            />
            <AnswerSection
              title="作答复盘（10秒速览）"
              content={answer.sections.review}
              defaultOpen={true}
              icon="📊"
              accentColor="border-l-emerald-500"
              bgColor="bg-emerald-50/30"
            />
            <AnswerSection
              title="通用模板（可复用）"
              content={answer.sections.template}
              defaultOpen={true}
              icon="📋"
              accentColor="border-l-blue-500"
              bgColor="bg-blue-50/30"
            />
            <AnswerSection
              title="踩坑提醒"
              content={answer.sections.pitfalls}
              defaultOpen={true}
              icon="⚠️"
              accentColor="border-l-amber-500"
              bgColor="bg-amber-50/30"
            />
            <AnswerSection
              title="注意事项"
              content={answer.sections.notes}
              defaultOpen={true}
              icon="📌"
              accentColor="border-l-rose-500"
              bgColor="bg-rose-50/30"
            />
          </div>
        )}
      </div>

      {/* ── 底部操作栏 ── */}
      {!isStreaming && (
        <div className="px-6 py-4 border-t border-zinc-100/60 bg-zinc-50/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onToggleFavorite && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-lg"
                onClick={() => onToggleFavorite(question.id)}
              >
                <Star
                  className={`h-3.5 w-3.5 ${question.isFavorite ? "fill-amber-400 text-amber-400" : "text-zinc-400"}`}
                />
                {question.isFavorite ? "已收藏" : "收藏"}
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-lg text-zinc-500 hover:text-red-600 hover:border-red-200"
                onClick={() => onDelete(question.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </Button>
            )}
          </div>
          <CopyButton
            text={displayRaw}
            label="复制全部答案"
            variant="outline"
          />
        </div>
      )}
    </div>
  );
}
