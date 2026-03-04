"use client";

import { useState, useEffect, useCallback } from "react";
import { ExamPaper, ExamPaperQuestion, BankQuestion, ExamAdvanceMode } from "@/lib/types";
import { getExamPapers, saveExamPapers, generateId } from "@/lib/storage";

export function useExamPapers() {
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPapers(getExamPapers());
    setLoaded(true);
  }, []);

  const createPaper = useCallback((name: string, advanceMode: ExamAdvanceMode = "manual"): ExamPaper => {
    const paper: ExamPaper = {
      id: generateId("EP"),
      name,
      questions: [],
      advanceMode,
      createdAt: new Date().toISOString(),
    };
    setPapers((prev) => {
      const next = [paper, ...prev];
      saveExamPapers(next);
      return next;
    });
    return paper;
  }, []);

  const updatePaper = useCallback((id: string, partial: Partial<ExamPaper>) => {
    setPapers((prev) => {
      const next = prev.map((p) => p.id === id ? { ...p, ...partial } : p);
      saveExamPapers(next);
      return next;
    });
  }, []);

  const deletePaper = useCallback((id: string) => {
    setPapers((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveExamPapers(next);
      return next;
    });
  }, []);

  const addQuestionToPaper = useCallback((paperId: string, bankQuestion: BankQuestion, timeLimit: number = 120) => {
    setPapers((prev) => {
      const next = prev.map((p) => {
        if (p.id !== paperId) return p;
        if (p.questions.some((q) => q.bankQuestionId === bankQuestion.id)) return p;
        const newQ: ExamPaperQuestion = {
          bankQuestionId: bankQuestion.id,
          questionContent: bankQuestion.content,
          timeLimit,
          order: p.questions.length + 1,
        };
        return { ...p, questions: [...p.questions, newQ] };
      });
      saveExamPapers(next);
      return next;
    });
  }, []);

  const removeQuestionFromPaper = useCallback((paperId: string, bankQuestionId: string) => {
    setPapers((prev) => {
      const next = prev.map((p) => {
        if (p.id !== paperId) return p;
        const filtered = p.questions.filter((q) => q.bankQuestionId !== bankQuestionId);
        return { ...p, questions: filtered.map((q, i) => ({ ...q, order: i + 1 })) };
      });
      saveExamPapers(next);
      return next;
    });
  }, []);

  const setQuestionTime = useCallback((paperId: string, bankQuestionId: string, timeLimit: number) => {
    setPapers((prev) => {
      const next = prev.map((p) => {
        if (p.id !== paperId) return p;
        return {
          ...p,
          questions: p.questions.map((q) =>
            q.bankQuestionId === bankQuestionId ? { ...q, timeLimit } : q
          ),
        };
      });
      saveExamPapers(next);
      return next;
    });
  }, []);

  const reorderQuestions = useCallback((paperId: string, fromIndex: number, toIndex: number) => {
    setPapers((prev) => {
      const next = prev.map((p) => {
        if (p.id !== paperId) return p;
        const qs = [...p.questions];
        const [moved] = qs.splice(fromIndex, 1);
        qs.splice(toIndex, 0, moved);
        return { ...p, questions: qs.map((q, i) => ({ ...q, order: i + 1 })) };
      });
      saveExamPapers(next);
      return next;
    });
  }, []);

  return {
    papers, loaded,
    createPaper, updatePaper, deletePaper,
    addQuestionToPaper, removeQuestionFromPaper,
    setQuestionTime, reorderQuestions,
  };
}
