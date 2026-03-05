"use client";

import { useState, useCallback, useRef } from "react";
import { ASRWord } from "@/lib/types";

export type ASRStatus = "idle" | "recording" | "processing" | "error";

export function useASR() {
  const [status, setStatus] = useState<ASRStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [words, setWords] = useState<ASRWord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const pcmChunksRef = useRef<Int16Array[]>([]);

  const cleanupRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    mediaRecorderRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    cleanupRecording();
    setError(null);
    setTranscript("");
    setWords([]);
    pcmChunksRef.current = [];
    mediaChunksRef.current = [];
    // Keep previous audioUrl until new recording starts
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      // Check secure context (getUserMedia requires HTTPS or localhost)
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("SECURE_CONTEXT");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // MediaRecorder for playback blob
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) mediaChunksRef.current.push(e.data);
      };
      recorder.start(500);

      // AudioContext + ScriptProcessor for PCM capture (16kHz Int16)
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        pcmChunksRef.current.push(int16);
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setStatus("recording");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const lower = message.toLowerCase();
      let friendly: string;
      if (message === "SECURE_CONTEXT") {
        friendly = "录音需要 HTTPS 环境，请使用 https:// 或 localhost 访问";
      } else if (lower.includes("not allowed") || lower.includes("permission") || lower.includes("notallowed")) {
        friendly = "请允许麦克风访问权限（浏览器地址栏左侧可重新授权）";
      } else if (lower.includes("not found") || lower.includes("no device")) {
        friendly = "未检测到麦克风设备";
      } else {
        friendly = `麦克风获取失败: ${message}`;
      }
      setError(friendly);
      setStatus("error");
    }
  }, [cleanupRecording, audioUrl]);

  const stopRecording = useCallback(
    async (apiKey: string): Promise<{ transcript: string; words: ASRWord[]; audioUrl: string; audioBlob: Blob } | null> => {
      if (status !== "recording") return null;
      setStatus("processing");

      // Get playback blob from MediaRecorder
      const playbackBlob = await new Promise<Blob>((resolve) => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === "inactive") {
          resolve(new Blob(mediaChunksRef.current));
          return;
        }
        recorder.onstop = () => {
          resolve(new Blob(mediaChunksRef.current, { type: recorder.mimeType }));
        };
        recorder.stop();
      });

      const playbackUrl = URL.createObjectURL(playbackBlob);
      setAudioUrl(playbackUrl);

      // Stop audio capture
      cleanupRecording();

      // Combine PCM chunks
      const totalLength = pcmChunksRef.current.reduce((acc, c) => acc + c.length, 0);
      if (totalLength === 0) {
        setStatus("idle");
        return { transcript: "", words: [], audioUrl: playbackUrl, audioBlob: playbackBlob };
      }

      const fullPcm = new Int16Array(totalLength);
      let offset = 0;
      for (const chunk of pcmChunksRef.current) {
        fullPcm.set(chunk, offset);
        offset += chunk.length;
      }
      pcmChunksRef.current = [];

      // Convert Int16Array to base64 (chunked to avoid call stack overflow)
      const bytes = new Uint8Array(fullPcm.buffer);
      const CHUNK = 8192;
      let binary = "";
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
        binary += String.fromCharCode.apply(null, Array.from(slice));
      }
      const base64Audio = btoa(binary);

      // Send to server for transcription
      try {
        const res = await fetch("/api/asr", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": apiKey,
          },
          body: JSON.stringify({ audio: base64Audio }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "转写失败");
        }

        const data = await res.json();
        const resultTranscript = data.transcript || "";
        const resultWords = data.words || [];
        setTranscript(resultTranscript);
        setWords(resultWords);
        setStatus("idle");
        return { transcript: resultTranscript, words: resultWords, audioUrl: playbackUrl, audioBlob: playbackBlob };
      } catch (err) {
        setError(err instanceof Error ? err.message : "转写请求失败");
        setStatus("error");
        return null;
      }
    },
    [status, cleanupRecording]
  );

  const resetASR = useCallback(() => {
    cleanupRecording();
    setStatus("idle");
    setTranscript("");
    setWords([]);
    setError(null);
    pcmChunksRef.current = [];
    mediaChunksRef.current = [];
    // Don't revoke audioUrl here — let it survive for review/playback
  }, [cleanupRecording]);

  return {
    status,
    transcript,
    words,
    error,
    audioUrl,
    startRecording,
    stopRecording,
    resetASR,
  };
}
