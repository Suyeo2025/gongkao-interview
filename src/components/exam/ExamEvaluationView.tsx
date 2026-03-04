"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { ExamSession, ExamEvaluation, ExamQuestionAnswer } from "@/lib/types";
import { TTSStatus } from "@/hooks/useTTS";

interface ExamEvaluationViewProps {
  session: ExamSession;
  evaluations: Map<number, ExamEvaluation>;
  isEvaluating: boolean;
  streamText: string;
  error: string | null;
  onEvaluate: () => void;
  onClose: () => void;
  onSaveEvaluations?: () => void;
  // TTS
  ttsStatus?: TTSStatus;
  ttsActiveId?: string | null;
  onSpeak?: (answerId: string, text: string) => void;
  onPauseTTS?: () => void;
  onResumeTTS?: () => void;
  onStopTTS?: () => void;
}

function ScoreBadge({ score }: { score: number }) {
  const colorClass =
    score >= 90
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : score >= 70
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-red-100 text-red-700 border-red-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${colorClass}`}>
      {score}分
    </span>
  );
}

function buildEvalSpeechText(evalResult: ExamEvaluation): string {
  const parts: string[] = [];
  if (evalResult.fullCommentary) parts.push(evalResult.fullCommentary);
  if (evalResult.suggestions) parts.push(evalResult.suggestions);
  return parts.length > 0 ? parts.join("\n") : "没有评语。";
}

function EvalTTSButton({
  evalId,
  evalResult,
  ttsStatus,
  ttsActiveId,
  onSpeak,
  onPause,
  onResume,
  onStop,
}: {
  evalId: string;
  evalResult: ExamEvaluation;
  ttsStatus?: TTSStatus;
  ttsActiveId?: string | null;
  onSpeak: (answerId: string, text: string) => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}) {
  const isActive = ttsActiveId === evalId;

  if (isActive && ttsStatus === "loading") {
    return (
      <button type="button" disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-purple-600 bg-purple-50 cursor-wait">
        <Icon name="progress_activity" size={14} className="animate-spin" />
        合成中…
      </button>
    );
  }

  if (isActive && ttsStatus === "playing") {
    return (
      <div className="inline-flex items-center gap-1.5">
        <button type="button" onClick={onPause}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
          <Icon name="pause" size={14} /> 暂停
        </button>
        <button type="button" onClick={onStop}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-zinc-500 bg-zinc-100 hover:bg-zinc-200 transition-colors">
          <Icon name="stop" size={14} />
        </button>
      </div>
    );
  }

  if (isActive && ttsStatus === "paused") {
    return (
      <div className="inline-flex items-center gap-1.5">
        <button type="button" onClick={onResume}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors">
          <Icon name="play_arrow" size={14} /> 继续
        </button>
        <button type="button" onClick={onStop}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-zinc-500 bg-zinc-100 hover:bg-zinc-200 transition-colors">
          <Icon name="stop" size={14} />
        </button>
      </div>
    );
  }

  return (
    <button type="button"
      onClick={() => onSpeak(evalId, buildEvalSpeechText(evalResult))}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors">
      <Icon name="volume_up" size={14} />
      朗读评语
    </button>
  );
}

export function ExamEvaluationView({
  session,
  evaluations,
  isEvaluating,
  streamText,
  error,
  onEvaluate,
  onClose,
  onSaveEvaluations,
  ttsStatus,
  ttsActiveId,
  onSpeak,
  onPauseTTS,
  onResumeTTS,
  onStopTTS,
}: ExamEvaluationViewProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  // Detect if evaluations were already saved in the session
  const alreadySaved = session.answers.some((a) => !!a.evaluation);
  const [savedToHistory, setSavedToHistory] = useState(alreadySaved);

  const totalScore =
    evaluations.size > 0
      ? Math.round(
          Array.from(evaluations.values()).reduce((sum, e) => sum + e.score, 0) /
            evaluations.size
        )
      : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <Icon name="rate_review" size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">AI 评估报告</h3>
            <p className="text-[11px] text-zinc-400">
              {session.paperName} · {session.answers.length} 题 ·{" "}
              {session.mode === "practice" ? "练习" : "模考"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {/* Score summary */}
      {totalScore !== null && (
        <div className="text-center py-4 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100/50 border border-amber-200/50">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">综合得分</p>
          <p
            className={`text-4xl font-bold ${
              totalScore >= 90
                ? "text-emerald-600"
                : totalScore >= 70
                  ? "text-amber-600"
                  : "text-red-600"
            }`}
          >
            {totalScore}
          </p>
          <p className="text-xs text-zinc-400 mt-1">满分 100</p>
        </div>
      )}

      {/* Evaluate button */}
      {evaluations.size === 0 && !isEvaluating && (
        <button
          type="button"
          onClick={onEvaluate}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          <Icon name="auto_awesome" size={16} />
          AI 评估作答
        </button>
      )}

      {/* Loading state */}
      {isEvaluating && (
        <div className="rounded-xl border border-zinc-200/60 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="progress_activity" size={16} className="text-purple-500 animate-spin" />
            <span className="text-xs text-zinc-500">导师正在认真审阅你的作答…</span>
          </div>
          {streamText && (
            <div className="max-h-[200px] overflow-y-auto text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap bg-zinc-50 rounded-lg p-3">
              {streamText}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50/80 rounded-lg px-3 py-2">
          <Icon name="error" size={14} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Per-question results */}
      {session.answers.length > 0 && (
        <div className="space-y-2">
          {session.answers.map((answer: ExamQuestionAnswer, i: number) => {
            const evalResult = evaluations.get(answer.questionIndex) || evaluations.get(i);
            const isExpanded = expandedIdx === i;

            return (
              <div
                key={i}
                className="rounded-xl border border-zinc-200/60 bg-white overflow-hidden"
              >
                {/* Question header */}
                <button
                  type="button"
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-zinc-50/50 transition-colors"
                >
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-xs text-zinc-700 line-clamp-1">
                    {answer.questionContent}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {evalResult && <ScoreBadge score={evalResult.score} />}
                    <Icon
                      name={isExpanded ? "expand_less" : "expand_more"}
                      size={16}
                      className="text-zinc-400"
                    />
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t border-zinc-100">
                    {/* Transcript */}
                    <div className="mt-3">
                      <p className="text-[10px] text-zinc-400 font-medium mb-1">考生作答</p>
                      <div className="bg-zinc-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-zinc-600 leading-relaxed">
                          {answer.asrTranscript || "（未作答）"}
                        </p>
                        <p className="text-[10px] text-zinc-300 mt-1.5">
                          用时 {answer.timeSpent}秒 / {answer.timeLimit}秒
                        </p>
                      </div>
                    </div>

                    {/* Evaluation */}
                    {evalResult && (
                      <>
                        <div>
                          <p className="text-[10px] text-zinc-400 font-medium mb-1">总评</p>
                          <p className="text-xs text-zinc-700 leading-relaxed">
                            {evalResult.summary}
                          </p>
                        </div>

                        {evalResult.strengths.length > 0 && (
                          <div>
                            <p className="text-[10px] text-emerald-600 font-medium mb-1">优点</p>
                            <ul className="space-y-1">
                              {evalResult.strengths.map((s, j) => (
                                <li key={j} className="flex items-start gap-1.5 text-xs text-zinc-600">
                                  <Icon name="check" size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {evalResult.weaknesses.length > 0 && (
                          <div>
                            <p className="text-[10px] text-red-600 font-medium mb-1">不足</p>
                            <ul className="space-y-1">
                              {evalResult.weaknesses.map((w, j) => (
                                <li key={j} className="flex items-start gap-1.5 text-xs text-zinc-600">
                                  <Icon name="close" size={12} className="text-red-500 mt-0.5 shrink-0" />
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {evalResult.suggestions && (
                          <div>
                            <p className="text-[10px] text-blue-600 font-medium mb-1">导师评语</p>
                            <p className="text-xs text-zinc-600 leading-relaxed bg-blue-50/50 rounded-lg px-3 py-2">
                              {evalResult.suggestions}
                            </p>
                          </div>
                        )}

                        {/* TTS button */}
                        {onSpeak && (
                          <div className="pt-2 border-t border-zinc-100">
                            <EvalTTSButton
                              evalId={`eval-${session.id}-${i}`}
                              evalResult={evalResult}
                              ttsStatus={ttsStatus}
                              ttsActiveId={ttsActiveId}
                              onSpeak={onSpeak}
                              onPause={onPauseTTS}
                              onResume={onResumeTTS}
                              onStop={onStopTTS}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Save evaluations button */}
      {evaluations.size > 0 && !isEvaluating && onSaveEvaluations && (
        <button
          type="button"
          onClick={() => {
            onSaveEvaluations();
            setSavedToHistory(true);
          }}
          disabled={savedToHistory}
          className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm ${
            savedToHistory
              ? "bg-zinc-100 text-zinc-400 cursor-default"
              : "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
          }`}
        >
          <Icon name={savedToHistory ? "check_circle" : "save"} size={16} />
          {savedToHistory ? "评估已保存" : "保存评估结果"}
        </button>
      )}
    </div>
  );
}
