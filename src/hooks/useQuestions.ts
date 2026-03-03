"use client";

import { useState, useEffect, useCallback } from "react";
import { QAPair, QuestionCategory } from "@/lib/types";
import { getHistory, saveHistory, deleteQAPair } from "@/lib/storage";

export function useQuestions() {
  const [history, setHistory] = useState<QAPair[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setHistory(getHistory());
    setLoaded(true);
  }, []);

  const addPair = useCallback((pair: QAPair) => {
    setHistory((prev) => {
      const next = [pair, ...prev];
      saveHistory(next);
      return next;
    });
  }, []);

  const updatePair = useCallback(
    (questionId: string, updater: (pair: QAPair) => QAPair) => {
      setHistory((prev) => {
        const next = prev.map((p) =>
          p.question.id === questionId ? updater(p) : p
        );
        saveHistory(next);
        return next;
      });
    },
    []
  );

  const removePair = useCallback((questionId: string) => {
    setHistory((prev) => {
      const next = deleteQAPair(questionId);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    (questionId: string) => {
      updatePair(questionId, (pair) => ({
        ...pair,
        question: { ...pair.question, isFavorite: !pair.question.isFavorite },
      }));
    },
    [updatePair]
  );

  const getByCategory = useCallback(
    (category: QuestionCategory | null) => {
      if (!category) return history;
      return history.filter(
        (p) =>
          p.question.category === category ||
          p.answer.metadata?.category === category
      );
    },
    [history]
  );

  const search = useCallback(
    (query: string) => {
      if (!query.trim()) return history;
      const q = query.toLowerCase();
      return history.filter(
        (p) =>
          p.question.content.toLowerCase().includes(q) ||
          p.answer.rawMarkdown.toLowerCase().includes(q)
      );
    },
    [history]
  );

  const stats = {
    total: history.length,
    favorites: history.filter((p) => p.question.isFavorite).length,
    byCategory: history.reduce(
      (acc, p) => {
        const cat =
          p.answer.metadata?.category || p.question.category || "综合分析";
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  return {
    history,
    loaded,
    addPair,
    updatePair,
    removePair,
    toggleFavorite,
    getByCategory,
    search,
    stats,
  };
}
