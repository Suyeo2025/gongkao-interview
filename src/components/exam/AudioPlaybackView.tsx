"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { Icon } from "@/components/Icon";
import { ASRWord, ExamEvaluation } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────

interface Chunk {
  words: ASRWord[];
  globalStart: number;
}

const COLOR_ACTIVE = "#fbbf24";
const COLOR_READ   = "rgba(255,255,255,0.95)";
const COLOR_UNREAD = "rgba(255,255,255,0.35)";

function chunkTimestamps(timestamps: ASRWord[], maxChars = 14): Chunk[] {
  if (timestamps.length === 0) return [];
  const chunks: Chunk[] = [];
  let buf: ASRWord[] = [];
  let charCount = 0;
  let start = 0;

  for (let i = 0; i < timestamps.length; i++) {
    const w = timestamps[i];
    buf.push(w);
    charCount += w.text.length;
    const t = w.text.trim();
    const isSentenceEnd = /[。！？!?]$/.test(t);
    const isClause = /[，,、；;：:]$/.test(t);

    if (
      isSentenceEnd ||
      (charCount >= maxChars && isClause) ||
      (charCount >= maxChars + 4) ||
      i === timestamps.length - 1
    ) {
      chunks.push({ words: [...buf], globalStart: start });
      start = i + 1;
      buf = [];
      charCount = 0;
    }
  }
  return chunks;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Component ───────────────────────────────────────────────────

type Tab = "play" | "eval";

interface AudioPlaybackViewProps {
  audioUrl: string;
  asrWords: ASRWord[];
  evaluation?: ExamEvaluation;
  questionContent?: string;
  onClose: () => void;
}

export function AudioPlaybackView({
  audioUrl,
  asrWords,
  evaluation,
  questionContent,
  onClose,
}: AudioPlaybackViewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<Tab>("play");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [showQuestion, setShowQuestion] = useState(true);

  const chunks = useMemo(() => chunkTimestamps(asrWords), [asrWords]);
  const textRef = useRef<HTMLParagraphElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const hasEval = !!evaluation;

  // ─── Blob-based audio loading ────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;

    const onCanPlay = () => {
      if (!cancelled) {
        setAudioReady(true);
        if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration);
      }
    };
    const onMeta = () => {
      if (!cancelled && audio.duration && isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => { setIsPlaying(false); setCurrentWordIndex(-1); };
    const onError = () => {
      if (cancelled) return;
      const code = audio.error?.code;
      const msg = audio.error?.message || "";
      if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        setAudioError("浏览器不支持此音频格式");
      } else if (code === MediaError.MEDIA_ERR_NETWORK) {
        setAudioError("网络错误，无法加载音频");
      } else {
        setAudioError(`音频加载失败${msg ? `: ${msg}` : ""}`);
      }
      setAudioReady(false);
    };
    const onTimeUpdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      const ms = t * 1000;
      let idx = -1;
      for (let i = 0; i < asrWords.length; i++) {
        if (ms >= asrWords[i].beginTime && ms < asrWords[i].endTime) { idx = i; break; }
        if (ms >= asrWords[i].beginTime) idx = i;
      }
      setCurrentWordIndex(idx);
    };

    audio.addEventListener("canplaythrough", onCanPlay);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", onTimeUpdate);

    fetch(audioUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        audio.src = url;
        audio.load();
      })
      .catch((err) => {
        if (!cancelled) setAudioError(`音频加载失败: ${err.message}`);
      });

    return () => {
      cancelled = true;
      audio.removeEventListener("canplaythrough", onCanPlay);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.pause();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [audioUrl, asrWords]);

  // ─── Chunk tracking ────────────────────
  const getChunkIdx = useCallback((wordIdx: number) => {
    if (wordIdx < 0 || chunks.length === 0) return 0;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      if (wordIdx >= c.globalStart && wordIdx < c.globalStart + c.words.length) return i;
    }
    return chunks.length - 1;
  }, [chunks]);

  const [activeChunkIdx, setActiveChunkIdx] = useState(0);
  const prevChunkRef = useRef(0);

  useEffect(() => {
    if (prevChunkRef.current !== activeChunkIdx && textRef.current) {
      const el = textRef.current;
      el.style.opacity = "0";
      void el.offsetWidth;
      el.style.opacity = "1";
    }
    prevChunkRef.current = activeChunkIdx;
  }, [activeChunkIdx]);

  useLayoutEffect(() => {
    const newChunkIdx = getChunkIdx(currentWordIndex);
    if (newChunkIdx !== activeChunkIdx) {
      setActiveChunkIdx(newChunkIdx);
      return;
    }
    const p = textRef.current;
    const chunk = chunks[activeChunkIdx];
    if (p && chunk) {
      for (let i = 0; i < p.children.length; i++) {
        const span = p.children[i] as HTMLElement;
        const gIdx = chunk.globalStart + i;
        if (gIdx === currentWordIndex) span.style.color = COLOR_ACTIVE;
        else if (gIdx < currentWordIndex) span.style.color = COLOR_READ;
        else span.style.color = COLOR_UNREAD;
      }
    }
  }, [currentWordIndex, activeChunkIdx, getChunkIdx, chunks]);

  useEffect(() => {
    if (progressRef.current && duration > 0 && !draggingRef.current) {
      progressRef.current.style.width = `${Math.min((currentTime / duration) * 100, 100)}%`;
    }
  }, [currentTime, duration]);

  // ─── Controls ────────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioReady) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying, audioReady]);

  const handleStop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    try { audio.currentTime = 0; } catch { /* */ }
    setIsPlaying(false);
    setCurrentWordIndex(-1);
    setCurrentTime(0);
  }, []);

  const handleClose = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    onClose();
  }, [onClose]);

  const handleBarSeek = useCallback((clientX: number) => {
    const bar = barRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    if (progressRef.current) progressRef.current.style.width = `${pct * 100}%`;
  }, [duration]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleBarSeek(e.clientX);
  }, [handleBarSeek]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    handleBarSeek(e.clientX);
  }, [handleBarSeek]);

  const handlePointerUp = useCallback(() => { draggingRef.current = false; }, []);

  const current = chunks[activeChunkIdx] ?? null;
  const plainText = asrWords.map((w) => w.text).join("");

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden select-none flex flex-col">
      {/* Hidden <audio> element */}
      <audio ref={audioRef} preload="auto" className="hidden" />

      {/* ── Background: solid, full coverage ── */}
      <div className="absolute inset-0 bg-zinc-900" />
      <img src="/tts-bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />

      {/* ── Top bar: 返回 + tab 切换 ── */}
      <div className="relative z-50 flex items-center gap-3 px-4 py-3 sm:px-6 shrink-0">
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm transition-colors"
        >
          <Icon name="arrow_back" size={16} className="text-white/80" />
          <span className="text-xs font-medium text-white/70">返回</span>
        </button>

        {/* Tab switcher */}
        {hasEval && (
          <div className="flex bg-white/10 backdrop-blur-sm rounded-full p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("play")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === "play"
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              <Icon name="play_circle" size={14} />
              录音回放
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("eval")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === "eval"
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              <Icon name="rate_review" size={14} />
              老师评语
            </button>
          </div>
        )}
      </div>

      {/* ══════ Tab: 录音回放 ══════ */}
      <div className={`relative z-30 flex-1 min-h-0 flex flex-col ${activeTab !== "play" ? "hidden" : ""}`}>
        {/* ── Top: 题目（点击隐藏） ── */}
        {questionContent && showQuestion && (
          <button
            type="button"
            onClick={() => setShowQuestion(false)}
            className="shrink-0 px-6 pt-2 pb-4 text-center group"
          >
            <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-2xl mx-auto"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
              {questionContent}
            </p>
            <span className="text-[10px] text-white/30 group-hover:text-white/50 transition-colors mt-1 inline-block">
              点击隐藏题目
            </span>
          </button>
        )}
        {questionContent && !showQuestion && (
          <button
            type="button"
            onClick={() => setShowQuestion(true)}
            className="shrink-0 px-6 pt-1 pb-2 flex justify-center"
          >
            <span className="text-[10px] text-white/30 hover:text-white/50 transition-colors inline-flex items-center gap-1">
              <Icon name="visibility" size={12} />
              显示题目
            </span>
          </button>
        )}

        {/* ── Center: spacer + error/loading ── */}
        <div className="flex-1 flex items-center justify-center px-6">
          {audioError && (
            <div className="bg-black/60 backdrop-blur-sm rounded-2xl p-6 max-w-sm text-center">
              <Icon name="error" size={32} className="text-red-400 mx-auto mb-3" />
              <p className="text-sm text-white/80 mb-2">{audioError}</p>
              <p className="text-[11px] text-white/40 mb-4 break-all">{audioUrl}</p>
              <button type="button" onClick={handleClose}
                className="px-5 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-sm transition-colors">
                返回
              </button>
            </div>
          )}
          {!audioReady && !audioError && (
            <div className="text-center">
              <Icon name="progress_activity" size={36} className="text-white/50 mx-auto mb-3 animate-spin" />
              <p className="text-xs text-white/40">加载音频…</p>
            </div>
          )}
        </div>

        {/* ── Bottom: 字幕 + 控制 + 进度条 ── */}
        {audioReady && !audioError && (
          <div className="shrink-0 px-4 sm:px-6 pb-6 sm:pb-8 w-full max-w-lg mx-auto">
            {/* Subtitle */}
            <div className="flex items-center justify-center h-[48px] mb-6">
              {current ? (
                <p
                  ref={textRef}
                  className="text-center text-2xl sm:text-3xl leading-none tracking-wide font-medium whitespace-nowrap"
                  style={{ color: COLOR_UNREAD, textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7)", transition: "opacity 0.15s ease-in-out" }}
                >
                  {current.words.map((w, i) => <span key={i}>{w.text}</span>)}
                </p>
              ) : (
                <p className="text-center text-2xl sm:text-3xl font-medium whitespace-nowrap"
                  style={{ color: COLOR_UNREAD, textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>
                  {plainText.slice(0, 30) || "点击播放"}
                </p>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <button type="button" onClick={handleStop}
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur-sm">
                <Icon name="stop" size={20} className="text-white/70" />
              </button>
              <button type="button" onClick={togglePlay} disabled={!audioReady}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  !audioReady ? "bg-white/10 cursor-not-allowed"
                    : isPlaying ? "bg-white/20 hover:bg-white/30 backdrop-blur-sm shadow-lg shadow-white/10"
                    : "bg-white hover:bg-zinc-100 shadow-lg shadow-white/20"
                }`}>
                <Icon name={isPlaying ? "pause" : "play_arrow"} size={32}
                  className={!audioReady ? "text-white/30" : isPlaying ? "text-white" : "text-zinc-800"} />
              </button>
              <div className="w-11 h-11" />
            </div>

            {/* Progress bar */}
            <div className="w-full flex items-center gap-2.5">
              <span className="text-[10px] text-white/50 font-mono tabular-nums w-[36px] text-right shrink-0">
                {formatTime(currentTime)}
              </span>
              <div ref={barRef}
                className="flex-1 h-[6px] rounded-full bg-white/15 cursor-pointer relative group"
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
                <div ref={progressRef}
                  className="h-full rounded-full bg-white/60 pointer-events-none relative" style={{ width: 0 }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <span className="text-[10px] text-white/50 font-mono tabular-nums w-[36px] shrink-0">
                {formatTime(duration)}
              </span>
            </div>
            {chunks.length > 0 && (
              <span className="text-[10px] text-white/30 font-mono tabular-nums mt-1.5 block text-center">
                {activeChunkIdx + 1} / {chunks.length}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ══════ Tab: 老师评语 ══════ */}
      {hasEval && (
        <div className={`relative z-30 flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 ${activeTab !== "eval" ? "hidden" : ""}`}>
          <div className="max-w-2xl mx-auto">
            <EvalPanel evaluation={evaluation!} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Eval Panel ──────────────────────────────────────────────────

function EvalPanel({ evaluation }: { evaluation: ExamEvaluation }) {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-5 sm:p-6 space-y-5">
      {/* Header + score */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          <Icon name="rate_review" size={20} className="text-white/70" />
        </div>
        <div className="flex-1">
          <span className="text-sm font-semibold text-white/80">导师评语</span>
          <p className="text-xs text-white/40 leading-relaxed mt-0.5 line-clamp-1">{evaluation.summary}</p>
        </div>
        <div className="text-center">
          <span className={`font-bold text-2xl ${
            evaluation.score >= 90 ? "text-emerald-400"
              : evaluation.score >= 70 ? "text-white"
                : "text-red-400"
          }`}>
            {evaluation.score}
          </span>
          <p className="text-[10px] text-white/40">分</p>
        </div>
      </div>

      {/* Full commentary */}
      {evaluation.fullCommentary && (
        <div>
          <p className="text-[10px] text-white/40 mb-2 font-medium tracking-wider">完整点评</p>
          <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
            {evaluation.fullCommentary}
          </p>
        </div>
      )}

      {/* Strengths */}
      {evaluation.strengths.length > 0 && (
        <div>
          <p className="text-[10px] text-emerald-400/80 mb-2 font-medium tracking-wider">优点</p>
          <ul className="space-y-1.5">
            {evaluation.strengths.map((s, j) => (
              <li key={j} className="text-sm text-white/60 flex items-start gap-2">
                <Icon name="check_circle" size={14} className="text-emerald-400 mt-0.5 shrink-0" />{s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {evaluation.weaknesses.length > 0 && (
        <div>
          <p className="text-[10px] text-red-400/80 mb-2 font-medium tracking-wider">不足</p>
          <ul className="space-y-1.5">
            {evaluation.weaknesses.map((w, j) => (
              <li key={j} className="text-sm text-white/60 flex items-start gap-2">
                <Icon name="cancel" size={14} className="text-red-400 mt-0.5 shrink-0" />{w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {evaluation.suggestions && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-[10px] text-white/40 mb-2 font-medium tracking-wider">改进建议</p>
          <p className="text-sm text-white/60 leading-relaxed">{evaluation.suggestions}</p>
        </div>
      )}
    </div>
  );
}
