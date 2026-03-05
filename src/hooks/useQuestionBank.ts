"use client";

import { useState, useEffect, useCallback } from "react";
import { BankQuestion, QuestionCategory, QAPair } from "@/lib/types";
import { getQuestionBank, saveQuestionBank, generateId } from "@/lib/storage";

export function useQuestionBank() {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // 1. Fast load from localStorage
    const local = getQuestionBank();
    setQuestions(local);
    setLoaded(true);

    // 2. Hydrate from server
    fetch("/api/data/questions")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setQuestions(data);
          saveQuestionBank(data);
        } else if (local.length > 0) {
          // Server has no data but localStorage does — push to server
          fetch("/api/data/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(local),
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const addQuestion = useCallback((content: string, category: QuestionCategory | null = null, source: "manual" | "file_upload" | "homepage" = "manual", sourceFile?: string) => {
    const trimmed = content.trim();
    const q: BankQuestion = {
      id: generateId("BQ"),
      content: trimmed,
      category,
      tags: [],
      source,
      sourceFile,
      createdAt: new Date().toISOString(),
    };
    let added = false;
    setQuestions((prev) => {
      if (prev.some((existing) => existing.content.trim() === trimmed)) return prev;
      added = true;
      const next = [q, ...prev];
      saveQuestionBank(next);
      // Server sync
      fetch("/api/data/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(q),
      }).catch(() => {});
      return next;
    });
    return added ? q : null!;
  }, []);

  const addQuestions = useCallback((items: Array<{ content: string; category?: QuestionCategory | null; sourceFile?: string }>) => {
    const newQuestions: BankQuestion[] = items.map((item) => ({
      id: generateId("BQ"),
      content: item.content.trim(),
      category: item.category ?? null,
      tags: [],
      source: item.sourceFile ? "file_upload" as const : "manual" as const,
      sourceFile: item.sourceFile,
      createdAt: new Date().toISOString(),
    }));
    setQuestions((prev) => {
      const next = [...newQuestions, ...prev];
      saveQuestionBank(next);
      // Server sync batch
      fetch("/api/data/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newQuestions),
      }).catch(() => {});
      return next;
    });
    return newQuestions;
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => {
      const next = prev.filter((q) => q.id !== id);
      saveQuestionBank(next);
      fetch("/api/data/questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(() => {});
      return next;
    });
  }, []);

  const updateQuestion = useCallback((id: string, partial: Partial<BankQuestion>) => {
    setQuestions((prev) => {
      const next = prev.map((q) => q.id === id ? { ...q, ...partial } : q);
      saveQuestionBank(next);
      fetch("/api/data/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...partial }),
      }).catch(() => {});
      return next;
    });
  }, []);

  const deriveQuestion = useCallback((originalId: string, content: string, category: QuestionCategory | null) => {
    const trimmed = content.trim();
    const q: BankQuestion = {
      id: generateId("BQ"),
      content: trimmed,
      category,
      tags: [],
      source: "edit_derived",
      derivedFrom: originalId,
      createdAt: new Date().toISOString(),
    };
    setQuestions((prev) => {
      const next = [q, ...prev];
      saveQuestionBank(next);
      fetch("/api/data/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(q),
      }).catch(() => {});
      return next;
    });
    return q;
  }, []);

  const search = useCallback((query: string) => {
    if (!query.trim()) return questions;
    const q = query.toLowerCase();
    return questions.filter((bq) => bq.content.toLowerCase().includes(q));
  }, [questions]);

  const filterByCategory = useCallback((category: QuestionCategory | null) => {
    if (!category) return questions;
    return questions.filter((bq) => bq.category === category);
  }, [questions]);

  // Sync homepage history questions into bank (deduped by content, updates categories)
  const syncFromHistory = useCallback((history: QAPair[]) => {
    setQuestions((prev) => {
      const existingMap = new Map(prev.map((q) => [q.content.trim(), q]));
      let updated = [...prev];
      let changed = false;

      // 1. Update categories for existing bank questions that lack one
      for (const pair of history) {
        const content = pair.question.content.trim();
        if (!content) continue;
        const category = pair.question.category ?? pair.answer?.metadata?.category ?? null;
        if (category && existingMap.has(content)) {
          const existing = existingMap.get(content)!;
          if (!existing.category) {
            const idx = updated.findIndex((q) => q.id === existing.id);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], category };
              changed = true;
            }
          }
        }
      }

      // 2. Add new questions not yet in bank
      const newQuestions: BankQuestion[] = [];
      for (const pair of history) {
        const content = pair.question.content.trim();
        if (!content || existingMap.has(content)) continue;
        existingMap.set(content, null!); // prevent duplicates within batch
        newQuestions.push({
          id: generateId("BQ"),
          content,
          category: pair.question.category ?? pair.answer?.metadata?.category ?? null,
          tags: [],
          source: "homepage",
          createdAt: pair.question.createdAt,
        });
      }

      if (newQuestions.length > 0) {
        updated = [...newQuestions, ...updated];
        changed = true;
        // Server sync new questions
        fetch("/api/data/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newQuestions),
        }).catch(() => {});
      }

      if (!changed) return prev;
      saveQuestionBank(updated);
      return updated;
    });
  }, []);

  // Update category for a bank question matched by content.
  // Falls back to direct localStorage if React state hasn't loaded the question yet.
  const updateCategoryByContent = useCallback((content: string, category: QuestionCategory) => {
    const trimmed = content.trim();
    let found = false;
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.content.trim() === trimmed);
      if (idx === -1) return prev;
      found = true;
      if (prev[idx].category === category) return prev; // already same
      const next = [...prev];
      next[idx] = { ...next[idx], category };
      saveQuestionBank(next);
      // Server sync
      fetch("/api/data/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: next[idx].id, category }),
      }).catch(() => {});
      return next;
    });
    // Fallback: update directly in localStorage if not found in React state
    // (handles race condition when hook hasn't loaded yet)
    if (!found) {
      const bank = getQuestionBank();
      const idx = bank.findIndex((q) => q.content.trim() === trimmed);
      if (idx !== -1 && bank[idx].category !== category) {
        bank[idx] = { ...bank[idx], category };
        saveQuestionBank(bank);
        // Server sync
        fetch("/api/data/questions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: bank[idx].id, category }),
        }).catch(() => {});
      }
    }
  }, []);

  const stats = {
    total: questions.length,
    byCategory: questions.reduce((acc, q) => {
      const cat = q.category || "未分类";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return {
    questions, loaded,
    addQuestion, addQuestions, removeQuestion, updateQuestion, deriveQuestion, updateCategoryByContent,
    syncFromHistory, search, filterByCategory,
    stats,
  };
}
