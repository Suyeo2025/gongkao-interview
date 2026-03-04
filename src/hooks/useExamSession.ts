"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ExamPaper,
  ExamMode,
  ExamSession,
  ExamQuestionAnswer,
  ASRWord,
} from "@/lib/types";
import { getExamSessions, saveExamSessions, generateId } from "@/lib/storage";

export type ExamPhase = "idle" | "answering" | "reviewing" | "finished";

export function useExamSession() {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [phase, setPhase] = useState<ExamPhase>("idle");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerVisible, setTimerVisible] = useState(true);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef = useRef<string>("");
  const questionStartTimeRef = useRef<number>(0); // epoch ms for elapsed calc
  const modeRef = useRef<ExamMode>("practice");
  const paperRef = useRef<ExamPaper | null>(null);

  // Timer effect
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTimerRunning, timerSeconds]);

  const startExam = useCallback((paper: ExamPaper, mode: ExamMode) => {
    const newSession: ExamSession = {
      id: generateId("ES"),
      paperId: paper.id,
      paperName: paper.name,
      mode,
      status: "in_progress",
      currentQuestionIndex: 0,
      answers: [],
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    setSession(newSession);
    setPhase("answering");
    modeRef.current = mode;
    paperRef.current = paper;

    if (mode === "exam") {
      // Total countdown for the whole exam
      setTimerSeconds(paper.totalTimeLimit || 1200);
    } else {
      // Per-question countdown
      const firstQ = paper.questions[0];
      if (firstQ) {
        setTimerSeconds(firstQ.timeLimit);
      }
    }
    setIsTimerRunning(true);
    questionStartRef.current = new Date().toISOString();
    questionStartTimeRef.current = Date.now();
  }, []);

  const getCurrentQuestion = useCallback(() => {
    if (!session) return null;
    return session;
  }, [session]);

  const finishQuestion = useCallback(
    (transcript: string, words: ASRWord[], paper: ExamPaper) => {
      if (!session) return;

      const idx = session.currentQuestionIndex;
      const paperQ = paper.questions[idx];
      if (!paperQ) return;

      const mode = modeRef.current;

      if (mode === "practice") {
        // Practice: stop timer, calculate timeSpent from per-question timer
        setIsTimerRunning(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
      // Exam mode: do NOT stop the global timer

      // Calculate timeSpent from questionStartTimeRef
      const elapsed = Math.round((Date.now() - questionStartTimeRef.current) / 1000);

      const answer: ExamQuestionAnswer = {
        questionIndex: idx,
        questionContent: paperQ.questionContent,
        asrTranscript: transcript,
        asrWords: words,
        timeSpent: Math.max(0, elapsed),
        timeLimit: paperQ.timeLimit,
        startedAt: questionStartRef.current,
        finishedAt: new Date().toISOString(),
      };

      const updatedSession = {
        ...session,
        answers: [...session.answers, answer],
      };
      setSession(updatedSession);

      if (mode === "practice") {
        // Practice: show review after each question
        setPhase("reviewing");
      } else {
        // Exam: auto-advance, no review
        advanceToNext(updatedSession, paper);
      }
    },
    [session, timerSeconds]
  );

  const advanceToNext = useCallback(
    (currentSession: ExamSession, paper: ExamPaper) => {
      const nextIdx = currentSession.currentQuestionIndex + 1;
      const mode = modeRef.current;

      if (nextIdx >= paper.questions.length) {
        // All questions done → finish
        setIsTimerRunning(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const finished = {
          ...currentSession,
          currentQuestionIndex: nextIdx,
          status: "completed" as const,
          finishedAt: new Date().toISOString(),
        };
        setSession(finished);
        setPhase("finished");

        const sessions = getExamSessions();
        saveExamSessions([finished, ...sessions]);
      } else {
        // Next question
        const nextSession = {
          ...currentSession,
          currentQuestionIndex: nextIdx,
        };
        setSession(nextSession);
        setPhase("answering");

        if (mode === "practice") {
          // Practice: reset timer to next question's time limit
          const nextQ = paper.questions[nextIdx];
          setTimerSeconds(nextQ.timeLimit);
          setIsTimerRunning(true);
        }
        // Exam mode: timer keeps running (global countdown), don't reset

        questionStartRef.current = new Date().toISOString();
        questionStartTimeRef.current = Date.now();
      }
    },
    []
  );

  const advanceQuestion = useCallback(
    (paper: ExamPaper) => {
      if (!session) return;
      advanceToNext(session, paper);
    },
    [session, advanceToNext]
  );

  const pauseTimer = useCallback(() => {
    setIsTimerRunning(false);
  }, []);

  const resumeTimer = useCallback(() => {
    if (timerSeconds > 0) {
      setIsTimerRunning(true);
    }
  }, [timerSeconds]);

  const toggleTimerVisibility = useCallback(() => {
    setTimerVisible((prev) => !prev);
  }, []);

  const finishExam = useCallback(
    (paper: ExamPaper, currentTranscript?: string, currentWords?: ASRWord[]) => {
      if (!session) return;

      // Stop timer
      setIsTimerRunning(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const answeredCount = session.answers.length;
      const extraAnswers: ExamQuestionAnswer[] = [];

      // Save current question's transcript if provided
      if (currentTranscript && answeredCount < paper.questions.length) {
        const currentQ = paper.questions[answeredCount];
        const elapsed = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
        extraAnswers.push({
          questionIndex: answeredCount,
          questionContent: currentQ.questionContent,
          asrTranscript: currentTranscript,
          asrWords: currentWords || [],
          timeSpent: Math.max(0, elapsed),
          timeLimit: currentQ.timeLimit,
          startedAt: questionStartRef.current,
          finishedAt: new Date().toISOString(),
        });
      }

      // Mark all remaining unanswered questions as skipped
      const startIdx = answeredCount + extraAnswers.length;
      for (let i = startIdx; i < paper.questions.length; i++) {
        const q = paper.questions[i];
        extraAnswers.push({
          questionIndex: i,
          questionContent: q.questionContent,
          asrTranscript: "（超时未答）",
          asrWords: [],
          timeSpent: 0,
          timeLimit: q.timeLimit,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
      }

      const finished = {
        ...session,
        answers: [...session.answers, ...extraAnswers],
        status: "completed" as const,
        finishedAt: new Date().toISOString(),
      };
      setSession(finished);
      setPhase("finished");

      const sessions = getExamSessions();
      saveExamSessions([finished, ...sessions]);
    },
    [session]
  );

  const exitExam = useCallback(() => {
    setSession(null);
    setPhase("idle");
    setTimerSeconds(0);
    setIsTimerRunning(false);
    setTimerVisible(true);
    modeRef.current = "practice";
    paperRef.current = null;
  }, []);

  // timerExpired differs per mode:
  // - practice: timer hits 0 during answering (single question timeout)
  // - exam: timer hits 0 during answering (entire exam timeout)
  const timerExpired = timerSeconds === 0 && phase === "answering" && !isTimerRunning && session !== null;

  return {
    session,
    phase,
    timerSeconds,
    timerVisible,
    isTimerRunning,
    timerExpired,
    startExam,
    getCurrentQuestion,
    finishQuestion,
    advanceQuestion,
    pauseTimer,
    resumeTimer,
    toggleTimerVisibility,
    finishExam,
    exitExam,
    setSession,
  };
}
