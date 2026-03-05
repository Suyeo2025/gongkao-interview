"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { ExamPaper, ExamMode, ExamSession, ExamQuestionAnswer, ExamEvaluation } from "@/lib/types";
import { useQuestionBank } from "@/hooks/useQuestionBank";
import { useExamPapers } from "@/hooks/useExamPapers";
import { useSettings } from "@/hooks/useSettings";
import { useExamEvaluation } from "@/hooks/useExamEvaluation";
import { useTTS } from "@/hooks/useTTS";
import { getHistory, getExamSessions, saveExamSessions } from "@/lib/storage";
import { QuestionBankPanel } from "@/components/exam/QuestionBankPanel";
import { FileUploadDialog } from "@/components/exam/FileUploadDialog";
import { ExamPaperBuilder } from "@/components/exam/ExamPaperBuilder";
import { ExamSimulation } from "@/components/exam/ExamSimulation";
import { ExamEvaluationView } from "@/components/exam/ExamEvaluationView";
import { ExamSessionList } from "@/components/exam/ExamSessionList";
import { AudioPlaybackView } from "@/components/exam/AudioPlaybackView";

export default function ExamPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const {
    questions: bankQuestions,
    addQuestion,
    addQuestions,
    removeQuestion,
    updateQuestion,
    deriveQuestion,
    syncFromHistory,
  } = useQuestionBank();

  // Sync homepage questions into bank on mount & compute answered set
  const [answeredContents, setAnsweredContents] = useState<Set<string>>(new Set());
  useEffect(() => {
    const history = getHistory();
    if (history.length > 0) {
      syncFromHistory(history);
      setAnsweredContents(new Set(history.map((p) => p.question.content.trim())));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const {
    papers,
    createPaper,
    updatePaper,
    deletePaper,
    addQuestionToPaper,
    removeQuestionFromPaper,
    setQuestionTime,
    reorderQuestions,
  } = useExamPapers();

  const {
    isEvaluating,
    evaluations,
    streamText: evalStreamText,
    error: evalError,
    evaluate,
    resetEvaluation,
    loadEvaluations,
  } = useExamEvaluation();

  const {
    status: ttsStatus,
    activeAnswerId: ttsActiveId,
    speak,
    pause: pauseTTS,
    resume: resumeTTS,
    stop: stopTTS,
  } = useTTS();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [examActive, setExamActive] = useState<{ paper: ExamPaper; mode: ExamMode } | null>(null);
  const [finishedSession, setFinishedSession] = useState<ExamSession | null>(null);
  const [activeTab, setActiveTab] = useState("bank");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const prevIsEvaluatingRef = useRef(false);
  const [playbackData, setPlaybackData] = useState<{
    answer: ExamQuestionAnswer;
    evaluation?: ExamEvaluation;
  } | null>(null);

  const handleGenerateAnswer = useCallback((content: string) => {
    router.push(`/?q=${encodeURIComponent(content)}`);
  }, [router]);

  const handleStartExam = useCallback((paper: ExamPaper, mode: ExamMode) => {
    if (paper.questions.length === 0) return;
    setExamActive({ paper, mode });
  }, []);

  const handleExamExit = useCallback(() => {
    setExamActive(null);
  }, []);

  const handleExamFinished = useCallback((session: ExamSession | null) => {
    setFinishedSession(session);
    setExamActive(null);
    // Auto-trigger AI evaluation
    if (session && session.answers.length > 0) {
      evaluate(session.answers, settings);
    }
  }, [evaluate, settings]);

  const handleEvaluate = useCallback(() => {
    if (!finishedSession) return;
    evaluate(finishedSession.answers, settings);
  }, [finishedSession, evaluate, settings]);

  const handleCloseEvaluation = useCallback(() => {
    setFinishedSession(null);
    resetEvaluation();
    stopTTS();
  }, [resetEvaluation, stopTTS]);

  // TTS for evaluation reading — use mentor voice settings
  const handleSpeakEval = useCallback(
    (answerId: string, text: string) => {
      speak(
        answerId,
        text,
        settings,
        settings.mentorVoice || undefined,
        undefined,
        settings.mentorVoiceName || undefined,
      );
    },
    [speak, settings]
  );

  // Save evaluations into the ExamSession and persist to localStorage + server
  const saveEvaluationsToSession = useCallback(() => {
    if (!finishedSession) return;

    // Embed evaluations into each answer
    const updatedAnswers = finishedSession.answers.map((a, i) => {
      const evalResult = evaluations.get(a.questionIndex) || evaluations.get(i);
      return evalResult ? { ...a, evaluation: evalResult } : a;
    });

    const totalScore = evaluations.size > 0
      ? Math.round(Array.from(evaluations.values()).reduce((s, e) => s + e.score, 0) / evaluations.size)
      : undefined;

    const updatedSession: ExamSession = {
      ...finishedSession,
      answers: updatedAnswers,
      totalScore,
    };

    // Update in localStorage
    const sessions = getExamSessions();
    const idx = sessions.findIndex((s) => s.id === finishedSession.id);
    if (idx !== -1) {
      sessions[idx] = updatedSession;
    } else {
      sessions.unshift(updatedSession);
    }
    saveExamSessions(sessions);

    // Sync to server
    fetch("/api/data/exam-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedSession),
    }).catch(() => {});

    // Update local state so re-opening shows evaluations
    setFinishedSession(updatedSession);
    return updatedSession;
  }, [finishedSession, evaluations]);

  // Auto-save evaluations when evaluation completes, then redirect to history
  useEffect(() => {
    const wasEvaluating = prevIsEvaluatingRef.current;
    prevIsEvaluatingRef.current = isEvaluating;

    if (wasEvaluating && !isEvaluating && evaluations.size > 0 && finishedSession) {
      saveEvaluationsToSession();
      // Delay, then close overlay and switch to history tab
      const timer = setTimeout(() => {
        setFinishedSession(null);
        resetEvaluation();
        stopTTS();
        setHistoryRefreshKey((k) => k + 1);
        setActiveTab("history");
      }, 1500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEvaluating]);

  return (
    <div className="min-h-screen bg-zinc-50/50">
      {/* Header */}
      <header className="h-12 sm:h-14 bg-white/80 backdrop-blur-xl px-3 sm:px-6 flex items-center justify-between shrink-0 border-b border-zinc-100">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-zinc-500"
            onClick={() => router.push("/")}
          >
            <Icon name="arrow_back" size={20} />
          </Button>
          <Logo className="w-7 h-7 sm:w-8 sm:h-8" />
          <div>
            <h1 className="text-xs sm:text-sm font-semibold text-zinc-800 tracking-tight">模拟考试</h1>
            <p className="text-[10px] text-zinc-400 hidden sm:block">题库管理 · 自由组卷 · 语音作答</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 h-10 sm:h-11 rounded-xl bg-zinc-100/80">
            <TabsTrigger value="bank" className="rounded-lg text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm data-[state=active]:text-zinc-700">
              <Icon name="library_books" size={16} />
              <span>题库</span>
              {bankQuestions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-medium">
                  {bankQuestions.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="papers" className="rounded-lg text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm data-[state=active]:text-zinc-700">
              <Icon name="description" size={16} />
              <span>试卷</span>
              {papers.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium">
                  {papers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm data-[state=active]:text-zinc-700">
              <Icon name="history" size={16} />
              <span>历史</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bank">
            <QuestionBankPanel
              questions={bankQuestions}
              onAdd={addQuestion}
              onAddBatch={addQuestions}
              onRemove={removeQuestion}
              onUpdate={updateQuestion}
              onDerive={deriveQuestion}
              onOpenUpload={() => setUploadDialogOpen(true)}
              settings={settings}
              onGenerate={handleGenerateAnswer}
              answeredContents={answeredContents}
            />
          </TabsContent>

          <TabsContent value="papers">
            <ExamPaperBuilder
              papers={papers}
              bankQuestions={bankQuestions}
              defaultTimePerQuestion={settings.defaultTimePerQuestion}
              onCreatePaper={createPaper}
              onDeletePaper={deletePaper}
              onUpdatePaper={updatePaper}
              onAddQuestion={addQuestionToPaper}
              onRemoveQuestion={removeQuestionFromPaper}
              onSetQuestionTime={setQuestionTime}
              onReorder={reorderQuestions}
              onStartExam={handleStartExam}
              onAddBankQuestion={addQuestion}
              onAddBankBatch={addQuestions}
              onRemoveBankQuestion={removeQuestion}
              onUpdateBankQuestion={updateQuestion}
              onDeriveBankQuestion={deriveQuestion}
              onOpenUpload={() => setUploadDialogOpen(true)}
              settings={settings}
              onGenerateAnswer={handleGenerateAnswer}
              answeredContents={answeredContents}
            />
          </TabsContent>

          <TabsContent value="history">
            <ExamSessionList
              refreshKey={historyRefreshKey}
              onViewSession={(s) => {
                setFinishedSession(s);
                loadEvaluations(s.answers);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <FileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        settings={settings}
        onAddBatch={addQuestions}
      />

      {/* Evaluation overlay after exam (hidden when playback is active) */}
      {finishedSession && !examActive && !playbackData && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-start justify-center overflow-y-auto py-4 sm:py-8 px-3 sm:px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-4 sm:p-5 border border-zinc-200/60">
            <ExamEvaluationView
              session={finishedSession}
              evaluations={evaluations}
              isEvaluating={isEvaluating}
              streamText={evalStreamText}
              error={evalError}
              onEvaluate={handleEvaluate}
              onClose={handleCloseEvaluation}
              onSaveEvaluations={saveEvaluationsToSession}
              onPlayAudio={(answer, evalResult) => setPlaybackData({ answer, evaluation: evalResult || answer.evaluation })}
              ttsStatus={ttsStatus}
              ttsActiveId={ttsActiveId}
              onSpeak={handleSpeakEval}
              onPauseTTS={pauseTTS}
              onResumeTTS={resumeTTS}
              onStopTTS={stopTTS}
            />
          </div>
        </div>
      )}

      {/* Fullscreen exam simulation overlay */}
      {examActive && (
        <ExamSimulation
          paper={examActive.paper}
          mode={examActive.mode}
          dashscopeApiKey={settings.dashscopeApiKey}
          onExit={handleExamExit}
          onFinished={handleExamFinished}
        />
      )}

      {/* Immersive audio playback overlay */}
      {playbackData?.answer.audioUrl && (
        <AudioPlaybackView
          audioUrl={playbackData.answer.audioUrl}
          asrWords={playbackData.answer.asrWords}
          evaluation={playbackData.evaluation}
          questionContent={playbackData.answer.questionContent}
          onClose={() => setPlaybackData(null)}
        />
      )}
    </div>
  );
}
