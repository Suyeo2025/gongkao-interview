"use client";

import { useState, useCallback, useRef } from "react";
import { Settings } from "@/lib/types";

interface GenerateState {
  isGenerating: boolean;
  streamText: string;
  thinkingText: string;
  isThinking: boolean;
  error: string | null;
}

export function useGenerate() {
  const [state, setState] = useState<GenerateState>({
    isGenerating: false,
    streamText: "",
    thinkingText: "",
    isThinking: false,
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

      setState({ isGenerating: true, streamText: "", thinkingText: "", isThinking: false, error: null });

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            provider: settings.textProvider,
            apiKey: settings.textProvider === "gemini" ? settings.geminiApiKey : settings.qwenApiKey,
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
        let rawBuffer = "";
        let thinkingContent = "";
        let answerContent = "";
        let inThinking = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          rawBuffer += decoder.decode(value, { stream: true });

          // Parse thinking markers
          if (!inThinking && rawBuffer.includes("<!--thinking-->")) {
            inThinking = true;
            rawBuffer = rawBuffer.replace("<!--thinking-->", "");
            setState((prev) => ({ ...prev, isThinking: true }));
          }

          if (inThinking && rawBuffer.includes("<!--/thinking-->")) {
            const parts = rawBuffer.split("<!--/thinking-->");
            thinkingContent += parts[0];
            answerContent += parts.slice(1).join("");
            rawBuffer = "";
            inThinking = false;
            setState((prev) => ({
              ...prev,
              thinkingText: thinkingContent,
              streamText: answerContent,
              isThinking: false,
            }));
          } else if (inThinking) {
            thinkingContent += rawBuffer;
            rawBuffer = "";
            setState((prev) => ({
              ...prev,
              thinkingText: thinkingContent,
            }));
          } else {
            answerContent += rawBuffer;
            rawBuffer = "";
            setState((prev) => ({
              ...prev,
              streamText: answerContent,
            }));
          }
        }

        setState((prev) => ({ ...prev, isGenerating: false, isThinking: false }));
        abortRef.current = null;
        return answerContent;
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
        setState({ isGenerating: false, streamText: "", thinkingText: "", isThinking: false, error: message });
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
