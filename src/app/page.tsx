"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { QuestionInput } from "@/components/QuestionInput";
import { AnswerCard } from "@/components/AnswerCard";
import { SettingsModal } from "@/components/SettingsModal";
import { useSettings } from "@/hooks/useSettings";
import { useQuestions } from "@/hooks/useQuestions";
import { useGenerate } from "@/hooks/useGenerate";
import { parseSections, parseMetadata, stripMetaBlock } from "@/lib/parser";
import { generateId } from "@/lib/storage";
import { QAPair, Question, Answer } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { settings, update: updateSettings, reset: resetSettings, loaded: settingsLoaded } = useSettings();
  const { history, addPair, toggleFavorite, removePair, stats, loaded: historyLoaded } = useQuestions();
  const { isGenerating, streamText, error, generate, stop, clearError } = useGenerate();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentStreamPair, setCurrentStreamPair] = useState<QAPair | null>(null);

  const answerEndRef = useRef<HTMLDivElement>(null);

  // Auto-open settings if no API key
  useEffect(() => {
    if (settingsLoaded && !settings.geminiApiKey) {
      setSettingsOpen(true);
    }
  }, [settingsLoaded, settings.geminiApiKey]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isGenerating && answerEndRef.current) {
      answerEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamText, isGenerating]);

  const handleSubmit = useCallback(
    async (questionText: string) => {
      if (!settings.geminiApiKey) {
        setSettingsOpen(true);
        return;
      }

      const qId = `Q${String(history.length + 1).padStart(3, "0")}`;
      const aId = `A${String(history.length + 1).padStart(3, "0")}`;

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
        setCurrentStreamPair(null);
        setSelectedId(finalQuestion.id);
      } catch {
        setCurrentStreamPair(null);
      }
    },
    [settings, history.length, generate, addPair]
  );

  const selectedPair = selectedId
    ? history.find((p) => p.question.id === selectedId) || null
    : null;

  const displayPair = currentStreamPair || selectedPair;

  if (!settingsLoaded || !historyLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-stone-50/50">
        <div className="text-sm text-zinc-400 animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-zinc-50 to-stone-50/50">
      <Header onOpenSettings={() => setSettingsOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-4 left-4 z-50 lg:hidden h-10 w-10 rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>

        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? "w-72" : "w-0"
          } transition-all duration-200 overflow-hidden shrink-0 lg:w-72`}
        >
          <Sidebar
            history={history}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setCurrentStreamPair(null);
            }}
            onToggleFavorite={toggleFavorite}
            stats={stats}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="max-w-3xl mx-auto p-8 space-y-6">
              {/* Question input */}
              <QuestionInput
                onSubmit={handleSubmit}
                onStop={stop}
                isGenerating={isGenerating}
                disabled={!settings.geminiApiKey}
                modelName={settings.modelName}
                streamWordCount={streamText.length}
              />

              {/* Error display */}
              {error && (
                <div className="bg-red-50/80 border border-red-200/60 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">生成失败</p>
                    <p className="text-xs text-red-600 mt-1">{error}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearError}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Current streaming / selected answer */}
              {displayPair ? (
                <AnswerCard
                  pair={displayPair}
                  isStreaming={isGenerating && !!currentStreamPair}
                  streamText={streamText}
                  onToggleFavorite={currentStreamPair ? undefined : toggleFavorite}
                  onDelete={currentStreamPair ? undefined : removePair}
                />
              ) : (
                /* Empty state */
                !isGenerating && (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">🎯</span>
                    </div>
                    <h3 className="text-base font-semibold text-zinc-700 mb-2">
                      开始你的面试模拟
                    </h3>
                    <p className="text-sm text-zinc-500 max-w-md mx-auto">
                      在上方输入面试题目，AI 将按照五板块结构为你生成标准化作答，
                      包含考生作答、复盘、通用模板、踩坑提醒和注意事项。
                    </p>
                    {!settings.geminiApiKey && (
                      <Button
                        variant="outline"
                        className="mt-4 text-violet-600 border-violet-200"
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
          </ScrollArea>

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
