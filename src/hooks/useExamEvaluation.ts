"use client";

import { useState, useCallback, useRef } from "react";
import { ExamEvaluation, ExamQuestionAnswer, Settings } from "@/lib/types";

export function useExamEvaluation() {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluations, setEvaluations] = useState<Map<number, ExamEvaluation>>(new Map());
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const parseEvalBlocks = useCallback((text: string): Map<number, ExamEvaluation> => {
    const results = new Map<number, ExamEvaluation>();
    const evalRegex = /```eval\s*\n?([\s\S]*?)```/g;

    // Split text into segments: [text before eval1, eval1 JSON, text before eval2, eval2 JSON, ...]
    // Extract commentary text that appears before each eval block
    const segments = text.split(/```eval\s*\n?[\s\S]*?```/);

    let match;
    let blockIdx = 0;
    while ((match = evalRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        // The commentary for this eval is the text segment before it
        const commentary = (segments[blockIdx] || "")
          .replace(/---\s*$/gm, "")
          .trim();
        const evaluation: ExamEvaluation = {
          score: parsed.score ?? 0,
          summary: parsed.summary ?? "",
          strengths: parsed.strengths ?? [],
          weaknesses: parsed.weaknesses ?? [],
          suggestions: parsed.suggestions ?? "",
          fullCommentary: commentary || undefined,
          modelUsed: "",
          evaluatedAt: new Date().toISOString(),
        };
        results.set(parsed.questionIndex ?? results.size, evaluation);
      } catch {
        // Skip malformed eval blocks
      }
      blockIdx++;
    }
    return results;
  }, []);

  const evaluate = useCallback(
    async (answers: ExamQuestionAnswer[], settings: Settings) => {
      setIsEvaluating(true);
      setError(null);
      setStreamText("");
      setEvaluations(new Map());

      const apiKey =
        settings.textProvider === "qwen" ? settings.qwenApiKey : settings.geminiApiKey;

      if (!apiKey) {
        setError(`请先配置 ${settings.textProvider === "qwen" ? "DashScope" : "Gemini"} API Key`);
        setIsEvaluating(false);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: answers.map((a) => ({
              questionIndex: a.questionIndex,
              questionContent: a.questionContent,
              asrTranscript: a.asrTranscript,
              timeSpent: a.timeSpent,
              timeLimit: a.timeLimit,
            })),
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
          setStreamText(accumulated);

          // Incrementally parse eval blocks
          const parsed = parseEvalBlocks(accumulated);
          if (parsed.size > 0) {
            setEvaluations(new Map(parsed));
          }
        }

        // Final parse
        const finalEvals = parseEvalBlocks(accumulated);
        // Set model info
        const modelUsed = `${settings.textProvider}/${settings.modelName}`;
        for (const [key, val] of finalEvals) {
          finalEvals.set(key, { ...val, modelUsed });
        }
        setEvaluations(finalEvals);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "评估失败");
        }
      } finally {
        setIsEvaluating(false);
        abortRef.current = null;
      }
    },
    [parseEvalBlocks]
  );

  const cancelEvaluation = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const resetEvaluation = useCallback(() => {
    cancelEvaluation();
    setIsEvaluating(false);
    setEvaluations(new Map());
    setStreamText("");
    setError(null);
  }, [cancelEvaluation]);

  // Load saved evaluations from an ExamSession's answers
  const loadEvaluations = useCallback((answers: ExamQuestionAnswer[]) => {
    const map = new Map<number, ExamEvaluation>();
    answers.forEach((a) => {
      if (a.evaluation) {
        map.set(a.questionIndex, a.evaluation);
      }
    });
    setEvaluations(map);
  }, []);

  return {
    isEvaluating,
    evaluations,
    streamText,
    error,
    evaluate,
    cancelEvaluation,
    resetEvaluation,
    loadEvaluations,
  };
}
