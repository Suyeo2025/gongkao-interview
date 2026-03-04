"use client";

import { useState, useMemo } from "react";
import { ExamPaper, ExamMode, BankQuestion, ExamAdvanceMode, QuestionCategory, Settings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/Icon";
import { QuestionBankPanel } from "./QuestionBankPanel";

interface ExamPaperBuilderProps {
  papers: ExamPaper[];
  bankQuestions: BankQuestion[];
  defaultTimePerQuestion: number;
  onCreatePaper: (name: string, advanceMode: ExamAdvanceMode) => ExamPaper;
  onDeletePaper: (id: string) => void;
  onUpdatePaper: (id: string, partial: Partial<ExamPaper>) => void;
  onAddQuestion: (paperId: string, bankQuestion: BankQuestion, timeLimit: number) => void;
  onRemoveQuestion: (paperId: string, bankQuestionId: string) => void;
  onSetQuestionTime: (paperId: string, bankQuestionId: string, time: number) => void;
  onReorder: (paperId: string, from: number, to: number) => void;
  onStartExam: (paper: ExamPaper, mode: ExamMode) => void;
  // For question bank panel
  onAddBankQuestion: (content: string, category: QuestionCategory | null) => BankQuestion;
  onAddBankBatch: (items: Array<{ content: string; category?: QuestionCategory | null; sourceFile?: string }>) => void;
  onRemoveBankQuestion: (id: string) => void;
  onUpdateBankQuestion: (id: string, partial: Partial<BankQuestion>) => void;
  onOpenUpload: () => void;
  settings?: Settings;
  onGenerateAnswer?: (content: string) => void;
  answeredContents?: Set<string>;
}

export function ExamPaperBuilder({
  papers,
  bankQuestions,
  defaultTimePerQuestion,
  onCreatePaper,
  onDeletePaper,
  onUpdatePaper,
  onAddQuestion,
  onRemoveQuestion,
  onSetQuestionTime,
  onReorder,
  onStartExam,
  onAddBankQuestion,
  onAddBankBatch,
  onRemoveBankQuestion,
  onUpdateBankQuestion,
  onOpenUpload,
  settings,
  onGenerateAnswer,
  answeredContents,
}: ExamPaperBuilderProps) {
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
  const [newPaperName, setNewPaperName] = useState("");
  const [showBankPicker, setShowBankPicker] = useState(false);

  const editingPaper = useMemo(
    () => papers.find((p) => p.id === editingPaperId) || null,
    [papers, editingPaperId]
  );

  const selectedIds = useMemo(
    () => new Set(editingPaper?.questions.map((q) => q.bankQuestionId) || []),
    [editingPaper]
  );

  const handleCreate = () => {
    const name = newPaperName.trim() || `试卷 ${papers.length + 1}`;
    const paper = onCreatePaper(name, "manual");
    setNewPaperName("");
    setEditingPaperId(paper.id);
  };

  const handleToggleBankQuestion = (bankId: string) => {
    if (!editingPaper) return;
    if (selectedIds.has(bankId)) {
      onRemoveQuestion(editingPaper.id, bankId);
    } else {
      const bq = bankQuestions.find((q) => q.id === bankId);
      if (bq) onAddQuestion(editingPaper.id, bq, defaultTimePerQuestion);
    }
  };

  const totalTime = editingPaper?.questions.reduce((sum, q) => sum + q.timeLimit, 0) || 0;
  const examTotalMinutes = editingPaper?.totalTimeLimit ? editingPaper.totalTimeLimit / 60 : 20;
  const canStartExam = (editingPaper?.questions.length ?? 0) >= 4;

  // Editing a specific paper
  if (editingPaper) {
    return (
      <div className="space-y-4">
        {/* Paper header */}
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingPaperId(null)}>
            <Icon name="arrow_back" size={18} />
          </Button>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-zinc-800">{editingPaper.name}</h3>
            <p className="text-[11px] text-zinc-400">
              {editingPaper.questions.length} 题 · 共 {Math.floor(totalTime / 60)} 分 {totalTime % 60} 秒
            </p>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className={`rounded-xl h-8 text-xs gap-1 ${showBankPicker ? "" : "border-amber-300 text-amber-600 hover:bg-amber-50"}`}
              onClick={() => setShowBankPicker(!showBankPicker)}
            >
              <Icon name={showBankPicker ? "close" : "add"} size={14} />
              {showBankPicker ? "收起题库" : "选题"}
            </Button>
          </div>
        </div>

        {/* Settings */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-lg">
            <button
              type="button"
              onClick={() => onUpdatePaper(editingPaper.id, { advanceMode: "manual" })}
              className={`px-2.5 py-1 rounded-md transition-all ${
                editingPaper.advanceMode === "manual" ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-500"
              }`}
            >
              手动切题
            </button>
            <button
              type="button"
              onClick={() => onUpdatePaper(editingPaper.id, { advanceMode: "auto" })}
              className={`px-2.5 py-1 rounded-md transition-all ${
                editingPaper.advanceMode === "auto" ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-500"
              }`}
            >
              自动切题
            </button>
          </div>

          {/* Total time for exam mode */}
          <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-200/60">
            <Icon name="hourglass_top" size={13} className="text-amber-500" />
            <span className="text-amber-600">模考总时间</span>
            <input
              type="number"
              value={examTotalMinutes}
              onChange={(e) => {
                const mins = Math.max(1, parseInt(e.target.value) || 20);
                onUpdatePaper(editingPaper.id, { totalTimeLimit: mins * 60 });
              }}
              className="w-10 text-[11px] text-center bg-white border border-amber-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-300"
              min={1}
              step={1}
            />
            <span className="text-amber-400">分钟</span>
          </div>
        </div>

        {/* Question bank picker */}
        {showBankPicker && (
          <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50/50">
            <QuestionBankPanel
              questions={bankQuestions}
              onAdd={onAddBankQuestion}
              onAddBatch={onAddBankBatch}
              onRemove={onRemoveBankQuestion}
              onUpdate={onUpdateBankQuestion}
              onOpenUpload={onOpenUpload}
              settings={settings}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleBankQuestion}
              onGenerate={onGenerateAnswer}
              answeredContents={answeredContents}
            />
          </div>
        )}

        {/* Paper questions */}
        {editingPaper.questions.length === 0 ? (
          <div className="text-center py-10 text-zinc-400">
            <Icon name="playlist_add" size={36} className="mx-auto mb-2 text-amber-300" />
            <p className="text-sm">点击"选题"从题库添加题目</p>
          </div>
        ) : (
          <div className="space-y-2">
            {editingPaper.questions.map((q, i) => (
              <div
                key={q.bankQuestionId}
                className="flex items-start gap-2.5 rounded-xl border border-zinc-200/60 bg-white px-3 py-2.5 group"
              >
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-800 leading-relaxed">{q.questionContent}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Time input */}
                  <div className="flex items-center gap-1 bg-zinc-50 rounded-lg px-1.5 py-0.5">
                    <Icon name="timer" size={12} className="text-zinc-400" />
                    <input
                      type="number"
                      value={q.timeLimit}
                      onChange={(e) => onSetQuestionTime(editingPaper.id, q.bankQuestionId, Math.max(10, parseInt(e.target.value) || 120))}
                      className="w-12 text-[11px] text-center bg-transparent border-0 p-0 focus:outline-none"
                      min={10}
                      step={10}
                    />
                    <span className="text-[10px] text-zinc-400">秒</span>
                  </div>
                  {/* Move up/down */}
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => onReorder(editingPaper.id, i, i - 1)}
                    className="p-0.5 text-zinc-300 hover:text-zinc-600 disabled:opacity-30"
                  >
                    <Icon name="arrow_upward" size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={i === editingPaper.questions.length - 1}
                    onClick={() => onReorder(editingPaper.id, i, i + 1)}
                    className="p-0.5 text-zinc-300 hover:text-zinc-600 disabled:opacity-30"
                  >
                    <Icon name="arrow_downward" size={14} />
                  </button>
                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => onRemoveQuestion(editingPaper.id, q.bankQuestionId)}
                    className="p-0.5 text-zinc-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Start exam buttons */}
        {editingPaper.questions.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex gap-2 sm:gap-3">
              <Button
                onClick={() => onStartExam(editingPaper, "practice")}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl h-10 sm:h-11 text-sm shadow-sm gap-1.5 active:scale-[0.98]"
              >
                <Icon name="school" size={16} />
                练习模式
              </Button>
              <Button
                onClick={() => onStartExam(editingPaper, "exam")}
                disabled={!canStartExam}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl h-10 sm:h-11 text-sm shadow-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                <Icon name="quiz" size={16} />
                模拟考试
              </Button>
            </div>
            {!canStartExam && (
              <p className="text-[11px] text-amber-500 text-center">
                模拟考试至少需要 4 题
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Paper list view
  return (
    <div className="space-y-4">
      {/* Create new paper */}
      <div className="flex gap-2">
        <Input
          value={newPaperName}
          onChange={(e) => setNewPaperName(e.target.value)}
          placeholder="试卷名称（可选）"
          className="h-9 rounded-xl text-sm flex-1 focus-visible:ring-amber-200"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <Button
          onClick={handleCreate}
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-xl h-9 text-xs shrink-0 hover:border-amber-300 hover:text-amber-600"
        >
          <Icon name="add" size={16} />
          新建试卷
        </Button>
      </div>

      {papers.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <Icon name="description" size={40} className="mx-auto mb-3 text-amber-300" />
          <p className="text-sm">还没有试卷</p>
          <p className="text-xs text-zinc-300 mt-1 flex items-center justify-center gap-1">新建试卷，从题库选题开始 <Icon name="arrow_forward" size={12} /></p>
        </div>
      ) : (
        <div className="space-y-2">
          {papers.map((paper) => (
            <div
              key={paper.id}
              className="group rounded-xl border border-zinc-200/60 bg-white px-4 py-3 hover:border-amber-300 transition-all cursor-pointer active:scale-[0.99] border-l-2 border-l-amber-300"
              onClick={() => setEditingPaperId(paper.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-zinc-800">{paper.name}</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {paper.questions.length} 题 ·
                    {paper.advanceMode === "auto" ? " 自动切题" : " 手动切题"} ·
                    {" "}{new Date(paper.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-400 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePaper(paper.id);
                    }}
                  >
                    <Icon name="delete" size={16} />
                  </Button>
                  <Icon name="chevron_right" size={18} className="text-zinc-300" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
