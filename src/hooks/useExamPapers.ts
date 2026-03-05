"use client";

import { useState, useEffect, useCallback } from "react";
import { ExamPaper, ExamPaperQuestion, BankQuestion, ExamAdvanceMode } from "@/lib/types";
import { getExamPapers, saveExamPapers, generateId } from "@/lib/storage";

export function useExamPapers() {
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const local = getExamPapers();
    setPapers(local);
    setLoaded(true);

    fetch("/api/data/exam-papers")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setPapers(data);
          saveExamPapers(data);
        } else if (local.length > 0) {
          // Push localStorage data to server
          for (const paper of local) {
            fetch("/api/data/exam-papers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(paper),
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  const syncPaperToServer = useCallback((paper: ExamPaper, method: "POST" | "PUT" | "DELETE" = "POST") => {
    fetch("/api/data/exam-papers", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(method === "DELETE" ? { id: paper.id } : paper),
    }).catch(() => {});
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
      syncPaperToServer(paper, "POST");
      return next;
    });
    return paper;
  }, [syncPaperToServer]);

  const updatePaper = useCallback((id: string, partial: Partial<ExamPaper>) => {
    setPapers((prev) => {
      const next = prev.map((p) => p.id === id ? { ...p, ...partial } : p);
      saveExamPapers(next);
      const updated = next.find((p) => p.id === id);
      if (updated) syncPaperToServer(updated, "PUT");
      return next;
    });
  }, [syncPaperToServer]);

  const deletePaper = useCallback((id: string) => {
    setPapers((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveExamPapers(next);
      syncPaperToServer({ id } as ExamPaper, "DELETE");
      return next;
    });
  }, [syncPaperToServer]);

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
      const updated = next.find((p) => p.id === paperId);
      if (updated) syncPaperToServer(updated, "PUT");
      return next;
    });
  }, [syncPaperToServer]);

  const removeQuestionFromPaper = useCallback((paperId: string, bankQuestionId: string) => {
    setPapers((prev) => {
      const next = prev.map((p) => {
        if (p.id !== paperId) return p;
        const filtered = p.questions.filter((q) => q.bankQuestionId !== bankQuestionId);
        return { ...p, questions: filtered.map((q, i) => ({ ...q, order: i + 1 })) };
      });
      saveExamPapers(next);
      const updated = next.find((p) => p.id === paperId);
      if (updated) syncPaperToServer(updated, "PUT");
      return next;
    });
  }, [syncPaperToServer]);

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
      const updated = next.find((p) => p.id === paperId);
      if (updated) syncPaperToServer(updated, "PUT");
      return next;
    });
  }, [syncPaperToServer]);

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
      const updated = next.find((p) => p.id === paperId);
      if (updated) syncPaperToServer(updated, "PUT");
      return next;
    });
  }, [syncPaperToServer]);

  return {
    papers, loaded,
    createPaper, updatePaper, deletePaper,
    addQuestionToPaper, removeQuestionFromPaper,
    setQuestionTime, reorderQuestions,
  };
}
