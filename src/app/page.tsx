"use client";

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";
import { Sidebar } from "@/components/Sidebar";
import { QuestionInput } from "@/components/QuestionInput";
import { AnswerCard } from "@/components/AnswerCard";
import { SettingsModal } from "@/components/SettingsModal";
import { useSettings } from "@/hooks/useSettings";
import { useQuestions } from "@/hooks/useQuestions";
import { useGenerate } from "@/hooks/useGenerate";
import { useTTS } from "@/hooks/useTTS";
import { useQuestionBank } from "@/hooks/useQuestionBank";
import { parseSections, parseMetadata, stripMetaBlock } from "@/lib/parser";
import { QAPair, Question, Answer, QuestionCategory, TTS_VOICE_NAMES, SectionKey, SectionVersion, SectionAnnotation } from "@/lib/types";
import { ensureSectionMeta, generateId } from "@/lib/storage";
import { CachedVoiceInfo } from "@/lib/audio-cache";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/button";

function HomeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { settings, update: updateSettings, reset: resetSettings, loaded: settingsLoaded } = useSettings();
  const { history, addPair, updatePair, toggleFavorite, removePair, stats, loaded: historyLoaded } = useQuestions();
  const { isGenerating, streamText, error, generate, stop, clearError } = useGenerate();
  const { status: ttsStatus, error: ttsError, activeAnswerId: ttsActiveId, timestamps: ttsTimestamps, currentWordIndex: ttsWordIndex, plainText: ttsPlainText, duration: ttsDuration, currentTime: ttsCurrentTime, rate: ttsRate, completionInfo: ttsCompletionInfo, speak, pause, resume, stop: stopTTS, setRate: setTTSRate, seek: seekTTS, clearCompletion: clearTTSCompletion, listCachedVoices: listCached, clearError: clearTTSError } = useTTS();
  const { questions: bankQuestions, addQuestion: addToBank, syncFromHistory: syncBankFromHistory, updateCategoryByContent: updateBankCategory } = useQuestionBank();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [currentStreamPair, setCurrentStreamPair] = useState<QAPair | null>(null);
  const [cachedVoices, setCachedVoices] = useState<CachedVoiceInfo[]>([]);

  const answerEndRef = useRef<HTMLDivElement>(null);

  const hasApiKey = settings.textProvider === "gemini"
    ? !!settings.geminiApiKey
    : !!settings.qwenApiKey;

  // Track which questions are already in the bank (by content)
  const bankContentSet = useMemo(
    () => new Set(bankQuestions.map((q) => q.content.trim())),
    [bankQuestions]
  );

  // Auto-open settings if no API key
  useEffect(() => {
    if (settingsLoaded && !hasApiKey) {
      setSettingsOpen(true);
    }
  }, [settingsLoaded, hasApiKey]);

  // Sync existing homepage questions to bank on first load
  useEffect(() => {
    if (historyLoaded && history.length > 0) {
      syncBankFromHistory(history);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded]);

  // Auto-generate or select from ?q= param (from question bank click)
  const autoGenTriggered = useRef(false);
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && settingsLoaded && historyLoaded && !autoGenTriggered.current && !isGenerating) {
      autoGenTriggered.current = true;
      router.replace("/", { scroll: false });
      // Check if already answered — select it instead of re-generating
      const existing = history.find((p) => p.question.content.trim() === q.trim());
      if (existing) {
        setSelectedId(existing.question.id);
        setCurrentStreamPair(null);
        // Sync category to bank if the existing answer has one
        const cat = existing.answer?.metadata?.category || existing.question.category;
        if (cat) {
          updateBankCategory(existing.question.content, cat);
        }
      } else if (hasApiKey) {
        handleSubmit(q);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, settingsLoaded, historyLoaded, hasApiKey]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isGenerating && answerEndRef.current) {
      answerEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamText, isGenerating]);

  const handleSubmit = useCallback(
    async (questionText: string) => {
      if (!hasApiKey) {
        setSettingsOpen(true);
        return;
      }

      const qId = generateId("Q");
      const aId = generateId("A");

      const question: Question = {
        id: qId,
        content: questionText,
        category: null,
        tags: [],
        createdAt: new Date().toISOString(),
        isFavorite: false,
      };

      const placeholderAnswer: Answer = {
        id: aId,
        questionId: qId,
        rawMarkdown: "",
        sections: { answer: "", review: "", template: "", pitfalls: "", notes: "" },
        metadata: null,
        createdAt: new Date().toISOString(),
        modelUsed: settings.modelName,
      };

      const streamingPair: QAPair = { question, answer: placeholderAnswer };
      setCurrentStreamPair(streamingPair);
      setSelectedId(null);

      try {
        const fullText = await generate(questionText, settings);

        if (!fullText) return;

        const sections = parseSections(fullText);
        const metadata = parseMetadata(fullText);
        const cleanMarkdown = stripMetaBlock(fullText);

        const finalAnswer: Answer = {
          ...placeholderAnswer,
          rawMarkdown: cleanMarkdown,
          sections,
          metadata,
        };

        const finalQuestion: Question = {
          ...question,
          category: metadata?.category || null,
        };

        const finalPair: QAPair = {
          question: finalQuestion,
          answer: finalAnswer,
        };

        addPair(finalPair);
        // Auto-sync to question bank (add or update category)
        addToBank(finalQuestion.content, metadata?.category || null, "homepage");
        if (metadata?.category) {
          updateBankCategory(finalQuestion.content, metadata.category);
        }
        setCurrentStreamPair(null);
        setSelectedId(finalQuestion.id);
      } catch {
        setCurrentStreamPair(null);
      }
    },
    [settings, generate, addPair, addToBank, updateBankCategory, hasApiKey]
  );

  const handleImportToBank = useCallback(
    (content: string, category: QuestionCategory | null) => {
      addToBank(content, category);
    },
    [addToBank]
  );

  const selectedPair = selectedId
    ? history.find((p) => p.question.id === selectedId) || null
    : null;

  const displayPair = currentStreamPair || selectedPair;

  const voiceName = settings.customVoiceName || TTS_VOICE_NAMES[settings.ttsVoice] || settings.ttsVoice;

  // Load cached voices when displayPair changes
  const displayAnswerId = displayPair?.answer.id;
  useEffect(() => {
    if (displayAnswerId && !isGenerating) {
      listCached(displayAnswerId).then(setCachedVoices);
    } else {
      setCachedVoices([]);
    }
  }, [displayAnswerId, isGenerating, listCached]);

  const handleSpeak = useCallback(
    async (voice?: string, model?: string, vName?: string) => {
      if (!displayPair) return;
      const text = displayPair.answer.sections.answer;
      if (!text.trim()) return;
      await speak(displayPair.answer.id, text, settings, voice, model, vName);
      // Refresh cached voices list after new generation
      listCached(displayPair.answer.id).then(setCachedVoices);
    },
    [displayPair, settings, speak, listCached]
  );

  const handleSpeakMentorEval = useCallback(
    async (text: string) => {
      if (!displayPair || !text.trim()) return;
      await speak(
        `${displayPair.answer.id}_mentor_eval`,
        text,
        settings,
        settings.mentorVoice,
        undefined,
        settings.mentorVoiceName,
      );
    },
    [displayPair, settings, speak]
  );

  // ─── Section edit / annotation / version handlers ─────────────

  const handleSectionUpdate = useCallback(
    (sectionKey: SectionKey, newContent: string, source: SectionVersion["source"], instruction?: string) => {
      if (!selectedId) return;
      updatePair(selectedId, (pair) => {
        const answer = ensureSectionMeta(pair.answer);
        const meta = answer.sectionMeta![sectionKey];
        const newVersion: SectionVersion = {
          id: generateId("ver_"),
          content: newContent,
          source,
          instruction,
          createdAt: new Date().toISOString(),
        };
        const versions = [newVersion, ...meta.versions].slice(0, 20);
        return {
          ...pair,
          answer: {
            ...answer,
            sections: { ...answer.sections, [sectionKey]: newContent },
            sectionMeta: {
              ...answer.sectionMeta!,
              [sectionKey]: { ...meta, versions, currentVersionId: newVersion.id },
            },
          },
        };
      });
    },
    [selectedId, updatePair]
  );

  const handleAnnotationAdd = useCallback(
    (sectionKey: SectionKey, content: string) => {
      if (!selectedId) return;
      updatePair(selectedId, (pair) => {
        const answer = ensureSectionMeta(pair.answer);
        const meta = answer.sectionMeta![sectionKey];
        const newAnnotation: SectionAnnotation = {
          id: generateId("ann_"),
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return {
          ...pair,
          answer: {
            ...answer,
            sectionMeta: {
              ...answer.sectionMeta!,
              [sectionKey]: { ...meta, annotations: [...meta.annotations, newAnnotation] },
            },
          },
        };
      });
    },
    [selectedId, updatePair]
  );

  const handleAnnotationDelete = useCallback(
    (sectionKey: SectionKey, annotationId: string) => {
      if (!selectedId) return;
      updatePair(selectedId, (pair) => {
        const answer = ensureSectionMeta(pair.answer);
        const meta = answer.sectionMeta![sectionKey];
        return {
          ...pair,
          answer: {
            ...answer,
            sectionMeta: {
              ...answer.sectionMeta!,
              [sectionKey]: {
                ...meta,
                annotations: meta.annotations.filter((a) => a.id !== annotationId),
              },
            },
          },
        };
      });
    },
    [selectedId, updatePair]
  );

  const handleAnnotationUpdate = useCallback(
    (sectionKey: SectionKey, annotationId: string, content: string) => {
      if (!selectedId) return;
      updatePair(selectedId, (pair) => {
        const answer = ensureSectionMeta(pair.answer);
        const meta = answer.sectionMeta![sectionKey];
        return {
          ...pair,
          answer: {
            ...answer,
            sectionMeta: {
              ...answer.sectionMeta!,
              [sectionKey]: {
                ...meta,
                annotations: meta.annotations.map((a) =>
                  a.id === annotationId
                    ? { ...a, content, updatedAt: new Date().toISOString() }
                    : a
                ),
              },
            },
          },
        };
      });
    },
    [selectedId, updatePair]
  );

  const handleVersionRestore = useCallback(
    (sectionKey: SectionKey, versionId: string) => {
      if (!selectedId) return;
      updatePair(selectedId, (pair) => {
        const answer = ensureSectionMeta(pair.answer);
        const meta = answer.sectionMeta![sectionKey];
        const target = meta.versions.find((v) => v.id === versionId);
        if (!target) return pair;
        // Restoring creates a new version (never delete history)
        const restoreVersion: SectionVersion = {
          id: generateId("ver_"),
          content: target.content,
          source: "manual_edit",
          createdAt: new Date().toISOString(),
        };
        const versions = [restoreVersion, ...meta.versions].slice(0, 20);
        return {
          ...pair,
          answer: {
            ...answer,
            sections: { ...answer.sections, [sectionKey]: target.content },
            sectionMeta: {
              ...answer.sectionMeta!,
              [sectionKey]: { ...meta, versions, currentVersionId: restoreVersion.id },
            },
          },
        };
      });
    },
    [selectedId, updatePair]
  );

  const sidebarContent = (
    <Sidebar
      history={history}
      selectedId={selectedId}
      onSelect={(id) => {
        setSelectedId(id);
        setCurrentStreamPair(null);
        setMobileSidebarOpen(false);
      }}
      onToggleFavorite={toggleFavorite}
      stats={stats}
      ttsActiveId={ttsActiveId}
    />
  );

  if (!settingsLoaded || !historyLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-amber-50/20 to-stone-50">
        <div className="text-sm text-zinc-400 animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-stone-50 via-amber-50/20 to-stone-50">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleSidebar={() => setMobileSidebarOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden lg:block w-72 shrink-0">
          {sidebarContent}
        </div>

        {/* Mobile sidebar — Sheet drawer */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0" showCloseButton={false}>
            {sidebarContent}
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-3 py-4 space-y-4 sm:px-5 sm:py-5 sm:space-y-5 md:px-6 md:py-6 lg:px-8 lg:py-8 lg:space-y-6">
              {/* Question input */}
              <QuestionInput
                onSubmit={handleSubmit}
                onStop={stop}
                isGenerating={isGenerating}
                disabled={!hasApiKey}
                modelName={settings.modelName}
                streamWordCount={streamText.length}
              />

              {/* Error display */}
              {error && (
                <div className="bg-red-50/80 border border-red-200/60 rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                  <Icon name="error" size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-800">生成失败</p>
                    <p className="text-xs text-red-600 mt-1 break-all">{error}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearError}
                    className="text-red-500 hover:text-red-700 h-8 w-8 shrink-0"
                  >
                    <Icon name="close" size={18} />
                  </Button>
                </div>
              )}

              {/* TTS error display */}
              {ttsError && (
                <div className="bg-orange-50/80 border border-orange-200/60 rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                  <Icon name="volume_off" size={20} className="text-orange-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-orange-800">语音合成失败</p>
                    <p className="text-xs text-orange-600 mt-1 break-all">{ttsError}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearTTSError}
                    className="text-orange-500 hover:text-orange-700 h-8 w-8 shrink-0"
                  >
                    <Icon name="close" size={18} />
                  </Button>
                </div>
              )}

              {/* Current streaming / selected answer */}
              {displayPair ? ((() => {
                const isStreaming = isGenerating && !!currentStreamPair;
                const isTTSTarget = !isStreaming && displayPair.answer.id === ttsActiveId;
                const isMentorTTSTarget = !isStreaming && ttsActiveId === `${displayPair.answer.id}_mentor_eval`;
                const isAnyTTSTarget = isTTSTarget || isMentorTTSTarget;
                const showTTS = !isStreaming;
                return (
                <AnswerCard
                  pair={displayPair}
                  isStreaming={isStreaming}
                  streamText={streamText}
                  onToggleFavorite={isStreaming ? undefined : toggleFavorite}
                  onDelete={isStreaming ? undefined : removePair}
                  onImportToBank={isStreaming ? undefined : handleImportToBank}
                  isInBank={bankContentSet.has(displayPair.question.content.trim())}
                  ttsStatus={isAnyTTSTarget ? ttsStatus : showTTS ? "idle" : undefined}
                  onSpeak={showTTS ? handleSpeak : undefined}
                  onPause={isAnyTTSTarget ? pause : undefined}
                  onResume={isAnyTTSTarget ? resume : undefined}
                  onStop={isAnyTTSTarget ? stopTTS : undefined}
                  timestamps={isTTSTarget ? ttsTimestamps : undefined}
                  currentWordIndex={isTTSTarget ? ttsWordIndex : undefined}
                  plainText={isTTSTarget ? ttsPlainText : undefined}
                  voiceName={voiceName}
                  ttsRate={ttsRate}
                  onSetRate={isTTSTarget ? setTTSRate : undefined}
                  onSeek={isTTSTarget ? seekTTS : undefined}
                  duration={isTTSTarget ? ttsDuration : undefined}
                  currentTime={isTTSTarget ? ttsCurrentTime : undefined}
                  cachedVoices={showTTS ? cachedVoices : undefined}
                  completionInfo={isTTSTarget || showTTS ? ttsCompletionInfo : undefined}
                  onClearCompletion={clearTTSCompletion}
                  onSectionUpdate={isStreaming ? undefined : handleSectionUpdate}
                  onAnnotationAdd={isStreaming ? undefined : handleAnnotationAdd}
                  onAnnotationDelete={isStreaming ? undefined : handleAnnotationDelete}
                  onAnnotationUpdate={isStreaming ? undefined : handleAnnotationUpdate}
                  onVersionRestore={isStreaming ? undefined : handleVersionRestore}
                  onSpeakMentorEval={isStreaming ? undefined : handleSpeakMentorEval}
                  ttsActiveId={ttsActiveId}
                  settings={settings}
                />);
              })()) : (
                /* Empty state */
                !isGenerating && (
                  <div className="text-center py-10 sm:py-14 lg:py-20">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Logo className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 opacity-60" />
                    </div>
                    <h3 className="text-sm sm:text-base font-semibold text-zinc-700 mb-1.5 sm:mb-2">
                      开始你的面试模拟
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto px-4">
                      在上方输入面试题目，AI 将按照五板块结构为你生成标准化作答
                    </p>
                    {!hasApiKey && (
                      <Button
                        variant="outline"
                        className="mt-4 text-amber-700 border-amber-200 h-10"
                        onClick={() => setSettingsOpen(true)}
                      >
                        先配置 API Key
                      </Button>
                    )}
                  </div>
                )
              )}

              <div ref={answerEndRef} />
            </div>
          </div>
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onUpdate={updateSettings}
        onReset={resetSettings}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-amber-50/20 to-stone-50">
        <div className="text-sm text-zinc-400 animate-pulse">加载中...</div>
      </div>
    }>
      <HomeInner />
    </Suspense>
  );
}
