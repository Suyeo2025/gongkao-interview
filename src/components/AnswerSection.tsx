"use client";

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { CopyButton } from "./CopyButton";
import { Icon } from "./Icon";
import { TTSStatus, CompletionInfo } from "@/hooks/useTTS";
import { WordTimestamp, CachedVoiceInfo } from "@/lib/audio-cache";
import { TTS_RATES } from "@/lib/types";

interface AnswerSectionProps {
  title: string;
  content: string;
  icon?: string;
  defaultOpen?: boolean;
  // TTS props — only provided for "考生作答" section
  ttsStatus?: TTSStatus;
  onSpeak?: (voice?: string, model?: string, voiceName?: string) => void;
  cachedVoices?: CachedVoiceInfo[];
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  timestamps?: WordTimestamp[];
  currentWordIndex?: number;
  plainText?: string;
  // New TTS control props
  voiceName?: string;
  ttsRate?: number;
  onSetRate?: (rate: number) => void;
  onSeek?: (time: number) => void;
  duration?: number;
  currentTime?: number;
  // Completion info
  completionInfo?: CompletionInfo | null;
  onClearCompletion?: () => void;
}

export function AnswerSection({
  title,
  content,
  icon = "",
  defaultOpen = true,
  ttsStatus,
  onSpeak,
  cachedVoices = [],
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
  completionInfo,
  onClearCompletion,
}: AnswerSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!content.trim()) return null;

  const showTTS = !!onSpeak;
  const isTTSActive = ttsStatus === "playing" || ttsStatus === "paused";
  const showCompletion = !!completionInfo && ttsStatus === "idle";

  const ttsButton = () => {
    if (!showTTS) return null;

    if (ttsStatus === "loading") {
      return (
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-amber-600 bg-amber-50 cursor-wait"
        >
          <Icon name="progress_activity" size={16} className="animate-spin" />
          <span className="hidden sm:inline">合成中</span>
        </button>
      );
    }

    if (ttsStatus === "playing") {
      return (
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={onPause}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <Icon name="pause" size={16} />
            <span className="hidden sm:inline">暂停</span>
          </button>
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-zinc-500 bg-zinc-100 hover:bg-zinc-200 transition-colors"
          >
            <Icon name="stop" size={16} />
          </button>
        </div>
      );
    }

    if (ttsStatus === "paused") {
      return (
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
          >
            <Icon name="play_arrow" size={16} />
            <span className="hidden sm:inline">继续</span>
          </button>
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-zinc-500 bg-zinc-100 hover:bg-zinc-200 transition-colors"
          >
            <Icon name="stop" size={16} />
          </button>
        </div>
      );
    }

    // idle — show speak button + cached voice chips
    return (
      <div className="inline-flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => onSpeak?.()}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-zinc-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          title="朗读此段作答"
        >
          <Icon name="volume_up" size={16} />
          <span className="hidden sm:inline">朗读</span>
        </button>
        {cachedVoices.length > 0 && cachedVoices.map((cv) => (
          <button
            key={`${cv.voice}:${cv.model}`}
            type="button"
            onClick={() => onSpeak?.(cv.voice, cv.model, cv.voiceName)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] text-zinc-400 hover:text-amber-600 hover:bg-amber-50/80 transition-colors border border-zinc-100 hover:border-amber-200"
            title={`使用缓存音色: ${cv.voiceName}`}
          >
            <Icon name="play_arrow" size={12} />
            <span className="max-w-[60px] truncate">{cv.voiceName}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="py-3 sm:py-4 border-b border-zinc-100/80 last:border-b-0">
      {/* Section header — clickable to toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 min-w-0 flex-1 text-left py-1 -my-1 cursor-pointer"
          onClick={() => setOpen(!open)}
        >
          {icon && <span className="text-base shrink-0">{icon}</span>}
          <span className="font-semibold text-sm text-zinc-800 truncate">
            {title}
          </span>
          <Icon
            name={open ? "expand_more" : "chevron_right"}
            size={18}
            className="text-zinc-400 shrink-0"
          />
        </button>
        <div className="shrink-0 ml-2 flex items-center gap-1">
          {ttsButton()}
          <CopyButton text={content} variant="ghost" />
        </div>
      </div>

      {/* Section content */}
      {open && (
        <div className="mt-2 sm:mt-3">
          {showCompletion ? (
            <CompletionView
              completionInfo={completionInfo!}
              onReplay={() => onSpeak?.()}
              onClose={() => onClearCompletion?.()}
            />
          ) : isTTSActive ? (
            <TeleprompterView
              timestamps={timestamps}
              currentWordIndex={currentWordIndex}
              plainText={plainText}
              isPaused={ttsStatus === "paused"}
              voiceName={voiceName}
              rate={ttsRate}
              onSetRate={onSetRate}
              onSeek={onSeek}
              duration={duration}
              currentTime={currentTime}
              onPause={onPause}
              onResume={onResume}
              onStop={onStop}
            />
          ) : (
            <MarkdownRenderer content={content} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

interface Chunk {
  words: WordTimestamp[];
  globalStart: number;
}

const COLOR_ACTIVE = "#fbbf24";   // amber-400
const COLOR_READ   = "rgba(255,255,255,0.95)";
const COLOR_UNREAD = "rgba(255,255,255,0.35)";
const BG_STYLE: React.CSSProperties = { backgroundImage: "url(/tts-bg.jpg)" };

function chunkTimestamps(timestamps: WordTimestamp[], maxChars = 14): Chunk[] {
  if (timestamps.length === 0) return [];
  const chunks: Chunk[] = [];
  let buf: WordTimestamp[] = [];
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

// ─── TeleprompterView ─────────────────────────────────────────────

function TeleprompterView({
  timestamps,
  currentWordIndex,
  plainText,
  isPaused,
  voiceName,
  rate = 1,
  onSetRate,
  onSeek,
  duration = 0,
  currentTime = 0,
  onPause,
  onResume,
  onStop,
}: {
  timestamps: WordTimestamp[];
  currentWordIndex: number;
  plainText: string;
  isPaused: boolean;
  voiceName?: string;
  rate?: number;
  onSetRate?: (rate: number) => void;
  onSeek?: (time: number) => void;
  duration?: number;
  currentTime?: number;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chunks = useMemo(() => chunkTimestamps(timestamps), [timestamps]);

  const getChunkIdx = useCallback((wordIdx: number) => {
    if (wordIdx < 0 || chunks.length === 0) return 0;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      if (wordIdx >= c.globalStart && wordIdx < c.globalStart + c.words.length) return i;
    }
    return chunks.length - 1;
  }, [chunks]);

  const [activeChunkIdx, setActiveChunkIdx] = useState(() => getChunkIdx(currentWordIndex));
  const textRef = useRef<HTMLParagraphElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const prevChunkRef = useRef(activeChunkIdx);

  // Fade-in on chunk transition
  useEffect(() => {
    if (prevChunkRef.current !== activeChunkIdx && textRef.current) {
      const el = textRef.current;
      el.style.opacity = "0";
      // Force reflow then fade in
      void el.offsetWidth;
      el.style.opacity = "1";
    }
    prevChunkRef.current = activeChunkIdx;
  }, [activeChunkIdx]);

  // Colorize spans — useLayoutEffect runs BEFORE browser paint, preventing flicker.
  // Spans have NO inline style in JSX (parent sets default color), so React never
  // resets colors during re-renders. Only this effect touches span colors.
  useLayoutEffect(() => {
    const newChunkIdx = getChunkIdx(currentWordIndex);

    if (newChunkIdx !== activeChunkIdx) {
      setActiveChunkIdx(newChunkIdx);
      return;
    }

    // Same chunk → update span colors directly (no re-render)
    const p = textRef.current;
    const chunk = chunks[activeChunkIdx];
    if (p && chunk) {
      for (let i = 0; i < p.children.length; i++) {
        const span = p.children[i] as HTMLElement;
        const gIdx = chunk.globalStart + i;
        if (gIdx === currentWordIndex) {
          span.style.color = COLOR_ACTIVE;
        } else if (gIdx < currentWordIndex) {
          span.style.color = COLOR_READ;
        } else {
          span.style.color = COLOR_UNREAD;
        }
      }
    }
  }, [currentWordIndex, activeChunkIdx, getChunkIdx, chunks]);

  // Progress bar & time display — separate effect, can run async (no flicker risk)
  useEffect(() => {
    if (progressRef.current && duration > 0 && !draggingRef.current) {
      const pct = (currentTime / duration) * 100;
      progressRef.current.style.width = `${Math.min(pct, 100)}%`;
    }
    if (counterRef.current && chunks.length > 0) {
      counterRef.current.textContent = `${activeChunkIdx + 1}/${chunks.length}`;
    }
    if (timeRef.current) {
      timeRef.current.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }
  }, [currentTime, duration, activeChunkIdx, chunks]);

  // ─── Seekable progress bar ─────
  const handleBarSeek = useCallback((clientX: number) => {
    const bar = barRef.current;
    if (!bar || !onSeek || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = pct * duration;
    onSeek(time);
    if (progressRef.current) {
      progressRef.current.style.width = `${pct * 100}%`;
    }
  }, [onSeek, duration]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleBarSeek(e.clientX);
  }, [handleBarSeek]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    handleBarSeek(e.clientX);
  }, [handleBarSeek]);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const current = chunks[activeChunkIdx] ?? null;

  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 overflow-hidden select-none"
    : "rounded-2xl overflow-hidden h-[300px] sm:h-[360px] relative select-none";

  const subtitleClass = isFullscreen
    ? "text-center text-2xl sm:text-3xl leading-none tracking-wide font-medium whitespace-nowrap"
    : "text-center text-[17px] sm:text-lg leading-none tracking-wide font-medium whitespace-nowrap";

  const subtitleFallbackClass = isFullscreen
    ? "text-center text-2xl sm:text-3xl font-medium whitespace-nowrap"
    : "text-center text-[17px] sm:text-lg font-medium whitespace-nowrap";

  const progressBarHeight = isFullscreen ? "h-[8px]" : "h-[6px]";

  return (
    <div className={containerClass}>
      {/* Background image */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={BG_STYLE} />

      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/50 to-transparent" />

      {/* Top-right: expand/collapse button */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors backdrop-blur-sm"
          title={isFullscreen ? "退出全屏" : "全屏模式"}
        >
          <Icon
            name={isFullscreen ? "close_fullscreen" : "open_in_full"}
            size={18}
            className="text-white/80"
          />
        </button>
      </div>

      {/* Subtitle + controls — pinned to bottom */}
      <div className={`absolute inset-x-0 bottom-0 px-4 sm:px-6 ${isFullscreen ? "pb-6 sm:pb-8" : "pb-3 sm:pb-4"}`}>

        {/* Subtitle text — single line, fade transition between chunks */}
        <div className={`flex items-center justify-center ${isFullscreen ? "h-[48px] mb-5" : "h-[36px] mb-3"}`}>
          {current ? (
            <p
              ref={textRef}
              className={subtitleClass}
              style={{
                color: COLOR_UNREAD,
                textShadow: "0 1px 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7)",
                transition: "opacity 0.15s ease-in-out",
              }}
            >
              {current.words.map((w, i) => (
                <span key={i}>{w.text}</span>
              ))}
            </p>
          ) : (
            <p
              className={subtitleFallbackClass}
              style={{ color: COLOR_UNREAD, textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}
            >
              {plainText.slice(0, 30)}
            </p>
          )}
        </div>

        {/* Fullscreen playback controls */}
        {isFullscreen && (
          <div className="flex items-center justify-center gap-3 mb-4">
            {isPaused ? (
              <button
                type="button"
                onClick={onResume}
                className="w-12 h-12 rounded-full bg-amber-400/90 hover:bg-amber-400 flex items-center justify-center transition-colors"
                title="继续"
              >
                <Icon name="play_arrow" size={28} className="text-black" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onPause}
                className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors backdrop-blur-sm"
                title="暂停"
              >
                <Icon name="pause" size={28} className="text-white" />
              </button>
            )}
            <button
              type="button"
              onClick={onStop}
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors backdrop-blur-sm"
              title="停止"
            >
              <Icon name="stop" size={22} className="text-white/80" />
            </button>
          </div>
        )}

        {/* Progress bar — seekable */}
        <div className="flex items-center gap-2 mb-2.5">
          <span ref={timeRef} className="text-[10px] text-white/50 font-mono tabular-nums w-[72px] sm:w-[80px] shrink-0">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div
            ref={barRef}
            className={`flex-1 ${progressBarHeight} rounded-full bg-white/15 cursor-pointer relative group`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              ref={progressRef}
              className="h-full rounded-full bg-amber-400 pointer-events-none relative"
              style={{ width: 0 }}
            >
              {/* Drag handle */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isPaused ? (
              <span className="text-[10px] text-white/40">已暂停</span>
            ) : (
              <span className="flex h-1.5 w-1.5 rounded-full bg-amber-400" />
            )}
            <span ref={counterRef} className="text-[10px] text-white/30 font-mono tabular-nums">
              {chunks.length > 0 ? `${activeChunkIdx + 1}/${chunks.length}` : ""}
            </span>
          </div>
        </div>

        {/* Bottom controls: voice name + speed */}
        <div className="flex items-center justify-between">
          {/* Voice name */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Icon name="graphic_eq" size={14} className="text-amber-400/70 shrink-0" />
            <span className="text-[11px] text-white/50 truncate max-w-[100px] sm:max-w-[140px]">
              {voiceName || "默认音色"}
            </span>
          </div>

          {/* Speed selector */}
          {onSetRate && (
            <div className="flex items-center gap-0.5">
              {TTS_RATES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onSetRate(value)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    Math.abs(rate - value) < 0.01
                      ? "bg-amber-400/90 text-black font-semibold"
                      : "text-white/40 hover:text-white/70 hover:bg-white/10"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CompletionView ───────────────────────────────────────────────

function CompletionView({
  completionInfo,
  onReplay,
  onClose,
}: {
  completionInfo: CompletionInfo;
  onReplay: () => void;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // wait for fade-out
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  return (
    <div
      className="rounded-2xl overflow-hidden h-[300px] sm:h-[360px] relative select-none transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={BG_STYLE} />
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-5">
        <div className="text-center space-y-4">
          <div className="text-3xl">✅</div>
          <p className="text-white text-lg font-semibold tracking-wide">朗读完成</p>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-center gap-2 text-white/80">
              <span>⏱️</span>
              <span>用时 {formatTime(completionInfo.elapsed)}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-white/60">
              <span>📝</span>
              <span>
                音频时长 {formatTime(completionInfo.audioDur)}
                {completionInfo.rate !== 1 && `（${completionInfo.rate}x 倍速）`}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-white/50">
              <span>🎙️</span>
              <span>音色：{completionInfo.voiceName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReplay}
            className="px-4 py-2 rounded-lg bg-amber-400/90 hover:bg-amber-400 text-black text-sm font-medium transition-colors"
          >
            再听一次
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white/80 text-sm font-medium transition-colors backdrop-blur-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
