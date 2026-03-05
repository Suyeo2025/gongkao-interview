"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { ExamPaper, ExamMode } from "@/lib/types";
import { useASR } from "@/hooks/useASR";
import { useExamSession, ExamPhase } from "@/hooks/useExamSession";
import { ExamTimer } from "./ExamTimer";
import { ExamTranscript } from "./ExamTranscript";

const BG_STYLE = {
  backgroundImage: "url(/tts-bg.jpg)",
  backgroundSize: "cover",
  backgroundPosition: "center",
};

interface ExamSimulationProps {
  paper: ExamPaper;
  mode: ExamMode;
  dashscopeApiKey: string;
  onExit: () => void;
  onFinished: (session: ReturnType<typeof useExamSession>["session"]) => void;
}

export function ExamSimulation({
  paper,
  mode,
  dashscopeApiKey,
  onExit,
  onFinished,
}: ExamSimulationProps) {
  const {
    session,
    phase,
    timerSeconds,
    timerVisible,
    isTimerRunning,
    timerExpired,
    startExam,
    finishQuestion,
    advanceQuestion,
    pauseTimer,
    resumeTimer,
    toggleTimerVisibility,
    markQuestionStart,
    finishExam,
    exitExam,
  } = useExamSession();

  const {
    status: asrStatus,
    transcript,
    words,
    error: asrError,
    audioUrl,
    startRecording,
    stopRecording,
    resetASR,
  } = useASR();

  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const [micReady, setMicReady] = useState(false);
  const processingRef = useRef(false);

  // Upload audio blob to server, return persistent URL
  const uploadAudio = useCallback(async (blob: Blob, sessionId: string, qIdx: number): Promise<string | undefined> => {
    try {
      const form = new FormData();
      form.append("file", blob, `${sessionId}-${qIdx}.webm`);
      form.append("sessionId", sessionId);
      form.append("questionIndex", String(qIdx));
      const res = await fetch("/api/audio", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        return data.url;
      }
    } catch { /* upload failure is non-critical */ }
    return undefined;
  }, []);

  // Start exam + pre-request mic permission on mount
  useEffect(() => {
    startExam(paper, mode);

    // Pre-request microphone permission so browser shows the dialog early
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          // Permission granted — release the stream immediately
          stream.getTracks().forEach((t) => t.stop());
          setMicReady(true);
        })
        .catch(() => {
          // Permission denied or unavailable — user will see error when they try to record
          setMicReady(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start timer when recording starts (mic connected)
  useEffect(() => {
    if (asrStatus === "recording" && phase === "answering" && !isPaused) {
      if (!isTimerRunning) {
        markQuestionStart();
        resumeTimer();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asrStatus]);

  // Timer expired handling
  useEffect(() => {
    if (timerExpired && phase === "answering" && !processingRef.current) {
      (async () => {
        processingRef.current = true;
        if (mode === "exam") {
          if (asrStatus === "recording") {
            const result = await stopRecording(dashscopeApiKey);
            if (result) {
              setLastAudioUrl(result.audioUrl);
              const serverUrl = session ? await uploadAudio(result.audioBlob, session.id, session.answers.length) : undefined;
              finishExam(paper, result.transcript || "（超时未答）", result.words || [], serverUrl);
            } else {
              finishExam(paper, "（超时未答）", []);
            }
          } else {
            finishExam(paper, "（超时未答）", []);
          }
          resetASR();
        } else {
          await doFinishAnswer();
        }
        processingRef.current = false;
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerExpired]);

  // Notify parent when exam finishes
  useEffect(() => {
    if (phase === "finished" && session) {
      onFinished(session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const currentQ = session
    ? paper.questions[session.currentQuestionIndex]
    : null;

  const totalQuestions = paper.questions.length;
  const currentIdx = session?.currentQuestionIndex ?? 0;

  // Start recording for current question
  const handleStartRecording = useCallback(() => {
    resetASR();
    setLastAudioUrl(null);
    startRecording();
  }, [resetASR, startRecording]);

  // Core finish logic (shared by button click and timer expiry)
  const doFinishAnswer = useCallback(async () => {
    if (asrStatus === "recording") {
      const result = await stopRecording(dashscopeApiKey);
      if (result) {
        setLastAudioUrl(result.audioUrl);
        const serverUrl = session ? await uploadAudio(result.audioBlob, session.id, session.currentQuestionIndex) : undefined;
        finishQuestion(result.transcript, result.words, paper, serverUrl);
      } else {
        finishQuestion("", [], paper);
      }
    } else {
      finishQuestion(transcript || "", words, paper);
    }
    resetASR();
  }, [asrStatus, stopRecording, dashscopeApiKey, finishQuestion, transcript, words, paper, resetASR, session, uploadAudio]);

  // Finish current answer: stop recording, transcribe, save answer
  const handleFinishAnswer = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    await doFinishAnswer();
    processingRef.current = false;
  }, [doFinishAnswer]);

  // Advance to next question (after review in practice mode)
  const handleNextQuestion = useCallback(() => {
    advanceQuestion(paper);
    resetASR();
    setLastAudioUrl(null);
  }, [advanceQuestion, paper, resetASR]);

  // Skip current question
  const handleSkip = useCallback(() => {
    finishQuestion("（跳过）", [], paper);
    resetASR();
    setLastAudioUrl(null);
  }, [finishQuestion, paper, resetASR]);

  // Pause/resume
  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      resumeTimer();
      setIsPaused(false);
    } else {
      pauseTimer();
      setIsPaused(true);
    }
  }, [isPaused, pauseTimer, resumeTimer]);

  // Exit exam
  const handleExit = useCallback(() => {
    resetASR();
    exitExam();
    onExit();
  }, [resetASR, exitExam, onExit]);

  // Finish exam early (交卷)
  const handleFinishExamEarly = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    if (asrStatus === "recording") {
      const result = await stopRecording(dashscopeApiKey);
      let serverUrl: string | undefined;
      if (result && session) {
        serverUrl = await uploadAudio(result.audioBlob, session.id, session.answers.length);
      }
      finishExam(paper, result?.transcript, result?.words, serverUrl);
    } else {
      finishExam(paper, transcript || undefined, transcript ? words : undefined);
    }
    resetASR();
    processingRef.current = false;
  }, [asrStatus, stopRecording, dashscopeApiKey, finishExam, paper, transcript, words, resetASR, session, uploadAudio]);

  const isRecording = asrStatus === "recording";
  const isProcessing = asrStatus === "processing";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={BG_STYLE} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/30" />

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 py-3 sm:px-6">
        {/* Left: question counter */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm">
            <span className="text-xs font-medium text-white/70">
              {mode === "practice" ? "练习" : "模考"} ·{" "}
              <span className="text-white font-semibold">
                {currentIdx + 1}
              </span>
              <span className="text-white/40">/{totalQuestions}</span>
            </span>
          </div>
          {paper.advanceMode === "auto" && (
            <span className="text-[10px] text-white/30 hidden sm:inline">自动切题</span>
          )}
        </div>

        {/* Center: timer */}
        {phase === "answering" && (
          <ExamTimer
            seconds={timerSeconds}
            visible={timerVisible}
            running={isTimerRunning}
            onToggleVisibility={toggleTimerVisibility}
          />
        )}

        {/* Right: controls */}
        <div className="flex items-center gap-2">
          {phase === "answering" && (
            <button
              type="button"
              onClick={handleTogglePause}
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors backdrop-blur-sm"
              title={isPaused ? "继续" : "暂停"}
            >
              <Icon
                name={isPaused ? "play_arrow" : "pause"}
                size={18}
                className="text-white/80"
              />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (phase === "finished") {
                handleExit();
              } else {
                setShowConfirmExit(true);
              }
            }}
            className="w-8 h-8 rounded-full bg-black/40 hover:bg-red-500/60 flex items-center justify-center transition-colors backdrop-blur-sm"
            title="退出"
          >
            <Icon name="close" size={18} className="text-white/80" />
          </button>
        </div>
      </div>

      {/* Progress bar (exam mode) */}
      {mode === "exam" && phase === "answering" && (
        <div className="absolute top-[52px] inset-x-0 z-10 px-4 sm:px-6">
          <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-zinc-300 to-zinc-400 transition-all duration-500"
              style={{ width: `${((session?.answers.length ?? 0) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
        {/* Paused overlay */}
        {isPaused && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <Icon name="pause_circle" size={64} className="text-white/40 mx-auto mb-4" />
              <p className="text-lg text-white/70 mb-4">考试已暂停</p>
              <button
                type="button"
                onClick={handleTogglePause}
                className="px-6 py-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-sm font-medium transition-colors"
              >
                继续作答
              </button>
            </div>
          </div>
        )}

        {/* Question display */}
        {phase === "answering" && currentQ && (
          <div className="w-full max-w-3xl text-center mb-8">
            <p className="text-xl sm:text-2xl md:text-3xl text-white font-medium leading-relaxed tracking-wide"
               style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
              {currentQ.questionContent}
            </p>
          </div>
        )}

        {/* Review phase (practice mode) */}
        {phase === "reviewing" && session && (
          <div className="w-full max-w-2xl text-center mb-8">
            <div className="mb-4 px-3 py-1.5 rounded-full bg-emerald-500/20 inline-flex items-center gap-1.5">
              <Icon name="check_circle" size={16} className="text-emerald-400" />
              <span className="text-xs text-emerald-300">作答完成</span>
            </div>
            <p className="text-base text-white/60 mb-3">你的回答：</p>
            <div className="rounded-xl bg-black/30 backdrop-blur-sm px-4 py-3 max-h-[200px] overflow-y-auto text-left">
              <p className="text-sm text-white/80 leading-relaxed">
                {session.answers[session.answers.length - 1]?.asrTranscript || "（未作答）"}
              </p>
            </div>
            {/* Playback button */}
            {lastAudioUrl && (
              <div className="mt-3">
                <audio controls src={lastAudioUrl} className="mx-auto h-8 opacity-70" />
              </div>
            )}
            {currentIdx + 1 < totalQuestions ? (
              /* ── 下一题：简洁按钮 ── */
              <button
                type="button"
                onClick={handleNextQuestion}
                className="mt-6 px-10 py-3 rounded-full bg-white/90 hover:bg-white text-zinc-800 font-semibold text-sm shadow-lg shadow-black/20 transition-all active:scale-95 inline-flex items-center gap-2"
              >
                下一题
                <Icon name="arrow_forward" size={16} />
              </button>
            ) : (
              /* ── 完成考试：醒目的完成区域 ── */
              <div className="mt-6 flex flex-col items-center gap-3">
                <p className="text-xs text-white/40">
                  全部 {totalQuestions} 题作答完毕
                </p>
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="group relative w-48 h-14 rounded-2xl transition-all active:scale-95"
                >
                  <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.4)] group-hover:shadow-[0_0_40px_rgba(52,211,153,0.6)] transition-shadow" />
                  <span className="absolute inset-0 rounded-2xl overflow-hidden">
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  </span>
                  <span className="relative z-10 flex items-center justify-center gap-2 text-white font-bold text-base">
                    <Icon name="done_all" size={20} />
                    完成考试
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Finished phase */}
        {phase === "finished" && session && (
          <div className="w-full max-w-md text-center">
            <Icon name="emoji_events" size={56} className="text-white/60 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">
              {mode === "practice" ? "练习完成" : "模拟考试完成"}
            </h2>
            <p className="text-sm text-white/50 mb-6">
              共 {session.answers.length} 题 ·{" "}
              {paper.name}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={handleExit}
                className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors backdrop-blur-sm"
              >
                返回
              </button>
            </div>
          </div>
        )}

        {/* ASR transcript & mic button (answering phase) */}
        {phase === "answering" && !isPaused && (
          <div className="w-full flex flex-col items-center gap-4">
            <ExamTranscript
              status={asrStatus}
              transcript={transcript}
              audioUrl={audioUrl}
            />

            {/* ASR error */}
            {asrError && (
              <p className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full">
                {asrError}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-4">
              {/* Skip button */}
              {!isProcessing && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 text-xs transition-colors"
                >
                  跳过
                </button>
              )}

              {/* Mic button */}
              {!isRecording && !isProcessing ? (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30 transition-all active:scale-95"
                  title="开始录音"
                >
                  <Icon name="mic" size={28} className="text-white" />
                </button>
              ) : isProcessing ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center">
                    <Icon name="progress_activity" size={28} className="text-white animate-spin" />
                  </div>
                  <span className="text-xs text-white/50">识别中…</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishAnswer}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 transition-all active:scale-95 animate-pulse"
                  title="结束录音"
                >
                  <Icon name="stop" size={28} className="text-white" />
                </button>
              )}

              {/* Finish exam early (exam mode, not first question) */}
              {mode === "exam" && currentIdx > 0 && !isProcessing && (
                <button
                  type="button"
                  onClick={handleFinishExamEarly}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 text-xs transition-colors"
                >
                  交卷
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirm exit dialog */}
      {showConfirmExit && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-zinc-700/50">
            <h3 className="text-base font-semibold text-white mb-2">确认退出？</h3>
            <p className="text-sm text-zinc-400 mb-5">
              退出后当前考试进度将丢失。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmExit(false)}
                className="flex-1 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
              >
                继续考试
              </button>
              <button
                type="button"
                onClick={handleExit}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm transition-colors"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
