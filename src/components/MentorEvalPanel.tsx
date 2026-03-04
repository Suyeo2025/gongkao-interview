"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Icon } from "./Icon";
import { ExamEvaluation, Settings } from "@/lib/types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { getMentorEvals, addMentorEval, MentorEvalVersion } from "@/lib/storage";
import { TTSStatus } from "@/hooks/useTTS";

interface MentorEvalPanelProps {
  answerId: string;
  questionContent: string;
  answerContent: string;
  settings: Settings;
  onSpeakText?: (text: string) => void;
  onPauseTTS?: () => void;
  onResumeTTS?: () => void;
  onStopTTS?: () => void;
  ttsStatus?: TTSStatus;
  ttsActiveId?: string | null;
}

function parseEvalBlock(text: string): ExamEvaluation | null {
  const regex = /```eval\s*\n?([\s\S]*?)```/g;
  const match = regex.exec(text);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    return {
      score: parsed.score ?? 0,
      summary: parsed.summary ?? "",
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
      suggestions: parsed.suggestions ?? "",
      modelUsed: "",
      evaluatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    score >= 60 ? "text-amber-600 bg-amber-50 border-amber-200" :
    "text-red-600 bg-red-50 border-red-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-lg font-bold border ${color}`}>
      {score}
      <span className="text-[10px] font-normal opacity-60">/ 100</span>
    </span>
  );
}

function stripEvalBlocks(text: string): string {
  return text
    .replace(/```eval\s*\n?[\s\S]*?```/g, "")
    .replace(/---\s*$/gm, "")
    .trim();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function MentorEvalPanel({ answerId, questionContent, answerContent, settings, onSpeakText, onPauseTTS, onResumeTTS, onStopTTS, ttsStatus, ttsActiveId }: MentorEvalPanelProps) {
  // Persisted versions
  const [versions, setVersions] = useState<MentorEvalVersion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0); // 0 = latest

  // Streaming state (new evaluation in progress)
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [liveEval, setLiveEval] = useState<ExamEvaluation | null>(null);
  const [liveText, setLiveText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  // Load saved versions on mount / answerId change
  useEffect(() => {
    const saved = getMentorEvals(answerId);
    setVersions(saved);
    setActiveIdx(0);
    setLiveEval(null);
    setLiveText("");
    setError(null);
  }, [answerId]);

  // Active version (null if viewing live stream with no saved version yet)
  const activeVersion = versions[activeIdx] ?? null;
  // What to display: live stream takes priority when evaluating, otherwise active saved version
  const displayEval = isEvaluating ? liveEval : (activeVersion?.evaluation ?? null);
  const displayText = isEvaluating ? liveText : (activeVersion?.fullText ?? "");

  const evaluate = useCallback(async () => {
    const apiKey = settings.textProvider === "qwen" ? settings.qwenApiKey : settings.geminiApiKey;
    if (!apiKey) {
      setError(`请先配置 ${settings.textProvider === "qwen" ? "DashScope" : "Gemini"} API Key`);
      return;
    }

    setIsEvaluating(true);
    setError(null);
    setLiveText("");
    setLiveEval(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: [{
            questionIndex: 0,
            questionContent,
            asrTranscript: answerContent,
            timeSpent: 120,
            timeLimit: 120,
          }],
          apiKey,
          provider: settings.textProvider,
          config: {
            modelName: settings.modelName,
            temperature: 0.5,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setLiveText(accumulated);
        const parsed = parseEvalBlock(accumulated);
        if (parsed) setLiveEval(parsed);
      }

      const finalEval = parseEvalBlock(accumulated);
      if (finalEval) {
        finalEval.modelUsed = `${settings.textProvider}/${settings.modelName}`;
        setLiveEval(finalEval);
        // Persist
        const fullText = stripEvalBlocks(accumulated);
        const newVersion = addMentorEval(answerId, finalEval, fullText);
        setVersions((prev) => [newVersion, ...prev]);
        setActiveIdx(0);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "评估失败");
      }
    } finally {
      setIsEvaluating(false);
      abortRef.current = null;
    }
  }, [answerId, questionContent, answerContent, settings]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsEvaluating(false);
  }, []);

  const hasContent = isEvaluating || versions.length > 0 || !!error;

  // No evaluations yet — just show the trigger button
  if (!hasContent) {
    return (
      <button
        type="button"
        onClick={evaluate}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 transition-colors"
      >
        <Icon name="school" size={16} />
        导师评价
      </button>
    );
  }

  return (
    <div className="border border-rose-200/60 rounded-xl overflow-hidden bg-rose-50/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-rose-50/80 border-b border-rose-100/60">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="school" size={16} className="text-rose-500 shrink-0" />
          <span className="text-xs font-semibold text-rose-700 shrink-0">张老师点评</span>
          {displayEval && <ScoreBadge score={displayEval.score} />}
          {displayEval?.summary && (
            <span className="text-xs text-zinc-600 italic truncate max-w-[180px] sm:max-w-none">
              &ldquo;{displayEval.summary}&rdquo;
            </span>
          )}
          {isEvaluating && (
            <span className="inline-flex items-center gap-1 text-[11px] text-rose-500 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              评估中…
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isEvaluating && (
            <button type="button" onClick={cancel} className="p-1 rounded-md text-rose-400 hover:text-rose-600 transition-colors" title="取消">
              <Icon name="close" size={14} />
            </button>
          )}
          {!isEvaluating && displayEval && (() => {
            const mentorTTSId = `${answerId}_mentor_eval`;
            const isMentorTTSActive = ttsActiveId === mentorTTSId;
            const mentorTTSStatus = isMentorTTSActive ? ttsStatus : "idle";

            const speakMentorText = () => {
              if (!onSpeakText) return;
              const parts: string[] = [];
              if (displayEval.summary) parts.push(displayEval.summary);
              if (displayEval.weaknesses.length > 0) parts.push(displayEval.weaknesses.join("。"));
              if (displayEval.suggestions) parts.push(displayEval.suggestions);
              onSpeakText(parts.join("\n"));
            };

            return (
              <>
                {onSpeakText && mentorTTSStatus === "loading" && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-rose-500 bg-rose-100/60">
                    <Icon name="progress_activity" size={13} className="animate-spin" />
                    合成中
                  </span>
                )}
                {onSpeakText && mentorTTSStatus === "playing" && (
                  <div className="inline-flex items-center gap-0.5">
                    <button type="button" onClick={onPauseTTS} className="p-1 rounded-md text-rose-500 hover:text-rose-700 bg-rose-100/60 hover:bg-rose-100 transition-colors" title="暂停">
                      <Icon name="pause" size={14} />
                    </button>
                    <button type="button" onClick={onStopTTS} className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 transition-colors" title="停止">
                      <Icon name="stop" size={14} />
                    </button>
                  </div>
                )}
                {onSpeakText && mentorTTSStatus === "paused" && (
                  <div className="inline-flex items-center gap-0.5">
                    <button type="button" onClick={onResumeTTS} className="p-1 rounded-md text-emerald-500 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors" title="继续">
                      <Icon name="play_arrow" size={14} />
                    </button>
                    <button type="button" onClick={onStopTTS} className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 transition-colors" title="停止">
                      <Icon name="stop" size={14} />
                    </button>
                  </div>
                )}
                {onSpeakText && (mentorTTSStatus === "idle" || !mentorTTSStatus) && (
                  <button
                    type="button"
                    onClick={speakMentorText}
                    className="p-1 rounded-md text-rose-400 hover:text-rose-600 transition-colors"
                    title="导师语音朗读"
                  >
                    <Icon name="record_voice_over" size={15} />
                  </button>
                )}
                <button type="button" onClick={() => setShowDetail(!showDetail)} className="p-1 rounded-md text-rose-400 hover:text-rose-600 transition-colors" title={showDetail ? "收起" : "展开"}>
                  <Icon name={showDetail ? "expand_less" : "expand_more"} size={16} />
                </button>
                <button type="button" onClick={evaluate} className="p-1 rounded-md text-rose-400 hover:text-rose-600 transition-colors" title="重新评价">
                  <Icon name="refresh" size={14} />
                </button>
              </>
            );
          })()}
        </div>
      </div>

      {/* Version selector */}
      {!isEvaluating && versions.length > 1 && showDetail && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50/50 border-b border-rose-100/40 overflow-x-auto no-scrollbar">
          {versions.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] transition-colors ${
                i === activeIdx
                  ? "bg-rose-200/60 text-rose-700 font-medium"
                  : "text-zinc-400 hover:text-rose-600 hover:bg-rose-100/50"
              }`}
            >
              {v.evaluation.score}分 · {formatTime(v.createdAt)}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {showDetail && (
        <div className="px-3 py-3 space-y-3">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Strengths / weaknesses summary */}
          {displayEval && (
            <div className="flex flex-wrap items-start gap-3 pb-2 border-b border-rose-100/60">
              {displayEval.strengths.length > 0 && (
                <div className="flex items-start gap-1 min-w-0">
                  <Icon name="thumb_up" size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-zinc-500 leading-relaxed">{displayEval.strengths.join("；")}</div>
                </div>
              )}
              {displayEval.weaknesses.length > 0 && (
                <div className="flex items-start gap-1 min-w-0">
                  <Icon name="thumb_down" size={13} className="text-red-500 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-zinc-500 leading-relaxed">{displayEval.weaknesses.join("；")}</div>
                </div>
              )}
            </div>
          )}

          {/* Full mentor text */}
          {displayText && (
            <div className="text-sm text-zinc-700 leading-relaxed prose prose-sm prose-zinc max-w-none">
              <MarkdownRenderer content={isEvaluating ? stripEvalBlocks(displayText) : displayText} />
              {isEvaluating && (
                <span className="inline-block w-2 h-4 bg-rose-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
              )}
            </div>
          )}

          {/* Model info */}
          {displayEval?.modelUsed && !isEvaluating && (
            <p className="text-[10px] text-zinc-300 text-right">{displayEval.modelUsed}</p>
          )}
        </div>
      )}
    </div>
  );
}
