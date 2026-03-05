"use client";

import { useState, useCallback, useRef } from "react";
import { ASRWord } from "@/lib/types";

export type ASRStatus = "idle" | "connecting" | "recording" | "processing" | "error";

export function useASR() {
  const [status, setStatus] = useState<ASRStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [words, setWords] = useState<ASRWord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionIdRef = useRef<string>("");
  const transcriptRef = useRef("");
  const wordsRef = useRef<ASRWord[]>([]);
  const sseReaderRef = useRef<ReadableStreamDefaultReader | null>(null);
  const taskStartedRef = useRef(false);
  const sendQueueRef = useRef<string[]>([]);
  const sendingRef = useRef(false);

  const cleanup = useCallback(() => {
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
    if (sseReaderRef.current) {
      sseReaderRef.current.cancel().catch(() => {});
      sseReaderRef.current = null;
    }
    sessionIdRef.current = "";
    taskStartedRef.current = false;
    sendQueueRef.current = [];
    sendingRef.current = false;
  }, []);

  // Flush queued audio chunks to server sequentially
  const flushQueue = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;

    while (sendQueueRef.current.length > 0) {
      const chunk = sendQueueRef.current.shift()!;
      try {
        await fetch("/api/asr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            action: "audio",
            audio: chunk,
          }),
        });
      } catch {
        // Connection lost, stop sending
        break;
      }
    }

    sendingRef.current = false;
  }, []);

  const startRecording = useCallback(async (apiKey: string) => {
    if (!apiKey) {
      setError("请先配置 DashScope API Key");
      setStatus("error");
      return;
    }

    cleanup();
    setError(null);
    setTranscript("");
    setInterimText("");
    setWords([]);
    transcriptRef.current = "";
    wordsRef.current = [];
    setStatus("connecting");

    try {
      // 1. Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Open SSE connection to server (this opens DashScope WebSocket on server)
      const sseRes = await fetch("/api/asr", {
        headers: { "X-Api-Key": apiKey },
      });
      if (!sseRes.ok || !sseRes.body) {
        throw new Error("无法建立 ASR 连接");
      }

      const reader = sseRes.body.getReader();
      sseReaderRef.current = reader;

      // 3. Start reading SSE events in background
      const decoder = new TextDecoder();
      let buffer = "";

      const readSSE = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            let eventType = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ") && eventType) {
                try {
                  const data = JSON.parse(line.slice(6));
                  handleSSEEvent(eventType, data);
                } catch { /* ignore parse errors */ }
                eventType = "";
              }
            }
          }
        } catch {
          // Stream ended or was cancelled
        }
      };

      const handleSSEEvent = (event: string, data: Record<string, unknown>) => {
        if (event === "session") {
          sessionIdRef.current = data.sessionId as string;
        } else if (event === "started") {
          taskStartedRef.current = true;
          setStatus("recording");
          // Start audio capture now that DashScope is ready
          startAudioCapture(stream);
          // Flush any queued audio
          flushQueue();
        } else if (event === "result") {
          const text = data.text as string;
          const isFinal = data.isFinal as boolean;
          const resultWords = data.words as ASRWord[];

          if (isFinal) {
            transcriptRef.current += text;
            setTranscript(transcriptRef.current);
            setInterimText("");
            if (resultWords?.length) {
              wordsRef.current = [...wordsRef.current, ...resultWords];
              setWords([...wordsRef.current]);
            }
          } else {
            setInterimText(text);
          }
        } else if (event === "finished") {
          setStatus("idle");
        } else if (event === "error") {
          setError(data.message as string);
          setStatus("error");
          cleanup();
        }
      };

      // Start reading SSE (non-blocking)
      readSSE();

    } catch (err) {
      const message = err instanceof Error ? err.message : "连接失败";
      setError(
        message.includes("NotAllowed") || message.includes("Permission")
          ? "请允许麦克风访问权限"
          : message
      );
      setStatus("error");
      cleanup();
    }
  }, [cleanup, flushQueue]);

  const startAudioCapture = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!sessionIdRef.current || !taskStartedRef.current) return;

        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Convert to base64 and queue for sending
        const bytes = new Uint8Array(int16.buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        sendQueueRef.current.push(base64);
        flushQueue();
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (err) {
      console.error("[ASR] audio capture error:", err);
      setError("音频采集失败");
      setStatus("error");
    }
  }, [flushQueue]);

  const stopRecording = useCallback(() => {
    // Stop audio capture first
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

    // Send stop signal to server
    if (sessionIdRef.current) {
      setStatus("processing");
      fetch("/api/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          action: "stop",
        }),
      }).catch(() => {});
      // SSE will receive "finished" event and set status to idle
    } else {
      setStatus("idle");
    }
  }, []);

  const resetASR = useCallback(() => {
    cleanup();
    setStatus("idle");
    setTranscript("");
    setInterimText("");
    setWords([]);
    setError(null);
    transcriptRef.current = "";
    wordsRef.current = [];
  }, [cleanup]);

  return {
    status,
    transcript,
    interimText,
    words,
    error,
    startRecording,
    stopRecording,
    resetASR,
  };
}
