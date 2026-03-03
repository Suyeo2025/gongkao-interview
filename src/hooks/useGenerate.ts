"use client";

import { useState, useCallback, useRef } from "react";
import { Settings } from "@/lib/types";

interface GenerateState {
  isGenerating: boolean;
  streamText: string;
  error: string | null;
}

export function useGenerate() {
  const [state, setState] = useState<GenerateState>({
    isGenerating: false,
    streamText: "",
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (question: string, settings: Settings): Promise<string> => {
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setState({ isGenerating: true, streamText: "", error: null });

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            apiKey: settings.geminiApiKey,
            config: {
              modelName: settings.modelName,
              temperature: settings.temperature,
            },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "请求失败" }));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("无法读取响应流");

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setState((prev) => ({
            ...prev,
            streamText: fullText,
          }));
        }

        setState((prev) => ({ ...prev, isGenerating: false }));
        abortRef.current = null;
        return fullText;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            error: null,
          }));
          return "";
        }

        const message = err instanceof Error ? err.message : "生成失败";
        setState({ isGenerating: false, streamText: "", error: message });
        throw err;
      }
    },
    []
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setState((prev) => ({ ...prev, isGenerating: false }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    generate,
    stop,
    clearError,
  };
}
