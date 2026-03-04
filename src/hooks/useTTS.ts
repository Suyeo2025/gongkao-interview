"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Settings } from "@/lib/types";
import { WordTimestamp, getCachedAudio, setCachedAudio, listCachedVoices, CachedVoiceInfo } from "@/lib/audio-cache";

export type TTSStatus = "idle" | "loading" | "playing" | "paused";

export interface CompletionInfo {
  elapsed: number;    // wall-clock seconds (includes pauses)
  audioDur: number;   // audio duration in seconds
  voiceName: string;
  rate: number;
}

// Binary search: find the word index for a given time in ms.
// Timestamps MUST be sorted by beginTime (ascending).
function findWordIndex(ts: WordTimestamp[], ms: number): number {
  if (ts.length === 0 || ms < ts[0].beginTime) return -1;

  // Binary search for the last word whose beginTime <= ms
  let lo = 0, hi = ts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ts[mid].beginTime <= ms) lo = mid;
    else hi = mid - 1;
  }

  // Exact match: ms falls within [beginTime, endTime)
  if (ms >= ts[lo].beginTime && ms < ts[lo].endTime) return lo;
  // Gap: ms is past word[lo]'s end — stay on word[lo] until next word starts
  if (ms >= ts[lo].endTime) return lo;

  return Math.max(lo - 1, -1);
}

// Deduplicate and sort timestamps (defensive — handles duplicates from cache or API)
function deduplicateTimestamps(ts: WordTimestamp[]): WordTimestamp[] {
  if (ts.length <= 1) return ts;
  const sorted = [...ts].sort((a, b) => a.beginTime - b.beginTime || a.endTime - b.endTime);
  const result: WordTimestamp[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    if (sorted[i].beginTime !== prev.beginTime || sorted[i].endTime !== prev.endTime) {
      result.push(sorted[i]);
    }
  }
  return result;
}

export function useTTS() {
  const [status, setStatus] = useState<TTSStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [timestamps, setTimestamps] = useState<WordTimestamp[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [plainText, setPlainText] = useState("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [rate, setRateState] = useState(1);
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);
  const [completionInfo, setCompletionInfo] = useState<CompletionInfo | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const timestampsRef = useRef<WordTimestamp[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastIdxRef = useRef(-1);
  const frameCountRef = useRef(0);
  const playStartRef = useRef<number | null>(null);
  const voiceNameRef = useRef("");

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  // Track current word by syncing audio.currentTime with timestamps.
  // Uses binary search O(log n) + monotonicity constraint to prevent flickering.
  const trackWord = useCallback(() => {
    const audio = audioRef.current;
    const ts = timestampsRef.current;
    if (!audio || ts.length === 0) {
      if (!audio?.paused && !audio?.ended) {
        rafRef.current = requestAnimationFrame(trackWord);
      }
      return;
    }

    const currentMs = audio.currentTime * 1000;
    let idx = findWordIndex(ts, currentMs);

    // Monotonicity: during normal playback word index can only advance.
    // (lastIdxRef is reset to -1 on seek, allowing backward jumps after seek)
    if (lastIdxRef.current >= 0 && idx >= 0 && idx < lastIdxRef.current) {
      idx = lastIdxRef.current;
    }

    // Only update state when index actually changes
    if (idx !== lastIdxRef.current) {
      lastIdxRef.current = idx;
      setCurrentWordIndex(idx);
    }

    // Update currentTime every 30 frames (~2Hz) — progress bar uses direct DOM
    // updates via refs so we only need state updates for initial render/seek.
    frameCountRef.current++;
    if (frameCountRef.current % 30 === 0) {
      setCurrentTime(audio.currentTime);
    }

    if (!audio.paused && !audio.ended) {
      rafRef.current = requestAnimationFrame(trackWord);
    }
  }, []);

  const speak = useCallback(
    async (
      answerId: string,
      rawText: string,
      settings: Settings,
      voiceOverride?: string,
      modelOverride?: string,
      voiceNameOverride?: string,
    ) => {
      cleanup();
      setError(null);
      setStatus("loading");
      setActiveAnswerId(answerId);
      setCurrentWordIndex(-1);
      setCurrentTime(0);
      setDuration(0);
      setCompletionInfo(null);
      lastIdxRef.current = -1;
      frameCountRef.current = 0;
      playStartRef.current = null;

      const useVoice = voiceOverride ?? settings.ttsVoice;
      const useModel = modelOverride ?? (settings.customVoiceTargetModel || settings.ttsModel);
      const useVoiceName = voiceNameOverride ?? (settings.customVoiceName || useVoice);
      // Determine instruct and rate: mentor voice uses mentor settings
      const isMentorMode = voiceOverride === settings.mentorVoice;
      const useInstruct = isMentorMode ? settings.mentorInstruct : settings.ttsInstruct;
      const useRate = isMentorMode ? (settings.mentorRate || settings.ttsRate) : settings.ttsRate;

      const clean = rawText.trim().slice(0, 2000);
      setPlainText(clean);
      setRateState(useRate);

      try {
        const cached = await getCachedAudio(
          answerId,
          clean,
          useVoice,
          useModel
        );

        let blob: Blob;
        let wordTimestamps: WordTimestamp[];

        if (cached) {
          blob = cached.blob;
          wordTimestamps = cached.timestamps;
        } else {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: clean,
              apiKey: settings.dashscopeApiKey,
              model: useModel,
              voice: useVoice,
              ...(settings.customVoiceTargetModel && !voiceOverride
                ? { customTargetModel: settings.customVoiceTargetModel }
                : {}),
              ...(useInstruct ? { instruct: useInstruct } : {}),
            }),
          });

          const data = await res.json();

          if (!res.ok || data.error) {
            throw new Error(data.error || `HTTP ${res.status}`);
          }

          // Decode base64 audio
          const binaryString = atob(data.audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: "audio/mpeg" });
          wordTimestamps = data.timestamps || [];

          await setCachedAudio(answerId, blob, wordTimestamps, clean, useVoice, useModel, useVoiceName);
        }

        // Client-side dedup + sort as a safety net (handles old cached data too)
        const deduped = deduplicateTimestamps(wordTimestamps);
        timestampsRef.current = deduped;
        setTimestamps(deduped);

        const url = URL.createObjectURL(blob);
        urlRef.current = url;

        const audio = new Audio(url);
        audio.playbackRate = useRate;
        audioRef.current = audio;

        audio.onloadedmetadata = () => {
          setDuration(audio.duration);
        };

        audio.onended = () => {
          const elapsed = playStartRef.current
            ? (Date.now() - playStartRef.current) / 1000
            : audio.duration || 0;
          setCompletionInfo({
            elapsed,
            audioDur: audio.duration || 0,
            voiceName: voiceNameRef.current,
            rate: audio.playbackRate,
          });
          setStatus("idle");
          setActiveAnswerId(null);
          setCurrentWordIndex(-1);
          setCurrentTime(0);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
        audio.onerror = () => {
          setStatus("idle");
          setActiveAnswerId(null);
          setError("音频播放失败");
          setCurrentWordIndex(-1);
        };

        await audio.play();
        playStartRef.current = Date.now();
        voiceNameRef.current = useVoiceName;
        setStatus("playing");
        rafRef.current = requestAnimationFrame(trackWord);
      } catch (err) {
        const message = err instanceof Error ? err.message : "TTS 失败";
        setError(message);
        setStatus("idle");
      }
    },
    [cleanup, trackWord]
  );

  const pause = useCallback(() => {
    if (audioRef.current && status === "playing") {
      audioRef.current.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setStatus("paused");
    }
  }, [status]);

  const resume = useCallback(() => {
    if (audioRef.current && status === "paused") {
      audioRef.current.play();
      setStatus("playing");
      rafRef.current = requestAnimationFrame(trackWord);
    }
  }, [status, trackWord]);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
    setActiveAnswerId(null);
    setCurrentWordIndex(-1);
    setCurrentTime(0);
    setDuration(0);
    lastIdxRef.current = -1;
    setTimestamps([]);
    setPlainText("");
  }, [cleanup]);

  const setRate = useCallback((r: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = r;
    }
    setRateState(r);
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(time, audio.duration || 0));
    setCurrentTime(audio.currentTime);
    // Reset monotonicity constraint so word index can jump freely after seek
    lastIdxRef.current = -1;
    // If paused, manually compute word index to update highlight
    if (audio.paused) {
      const idx = findWordIndex(timestampsRef.current, audio.currentTime * 1000);
      lastIdxRef.current = idx;
      setCurrentWordIndex(idx);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const clearCompletion = useCallback(() => setCompletionInfo(null), []);

  return {
    status,
    error,
    activeAnswerId,
    timestamps,
    currentWordIndex,
    plainText,
    duration,
    currentTime,
    rate,
    completionInfo,
    speak,
    pause,
    resume,
    stop,
    setRate,
    seek,
    clearCompletion,
    listCachedVoices,
    clearError: useCallback(() => setError(null), []),
  };
}
