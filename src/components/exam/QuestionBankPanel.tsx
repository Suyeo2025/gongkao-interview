"use client";

import { useState, useMemo } from "react";
import { BankQuestion, QuestionCategory, ALL_CATEGORIES, CATEGORY_COLORS, Settings, DEFAULT_SETTINGS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/Icon";
import { AddQuestionDialog } from "./AddQuestionDialog";
import { EditQuestionDialog } from "./EditQuestionDialog";

interface QuestionBankPanelProps {
  questions: BankQuestion[];
  onAdd: (content: string, category: QuestionCategory | null) => BankQuestion;
  onAddBatch: (items: Array<{ content: string; category?: QuestionCategory | null; sourceFile?: string }>) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, partial: Partial<BankQuestion>) => void;
  onDerive?: (originalId: string, content: string, category: QuestionCategory | null) => void;
  onOpenUpload: () => void;
  settings?: Settings;
  /** IDs of questions selected for exam paper building */
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /** Navigate to homepage and auto-generate answer */
  onGenerate?: (content: string) => void;
  /** Set of question contents that already have AI answers on homepage */
  answeredContents?: Set<string>;
}

export function QuestionBankPanel({
  questions,
  onAdd,
  onRemove,
  onUpdate,
  onDerive,
  onOpenUpload,
  settings,
  selectedIds,
  onToggleSelect,
  onGenerate,
  answeredContents,
}: QuestionBankPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<QuestionCategory | "all">("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<BankQuestion | null>(null);

  const filtered = useMemo(() => {
    let list = questions;
    if (filterCategory !== "all") {
      list = list.filter((q) => q.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((bq) => bq.content.toLowerCase().includes(q));
    }
    return list;
  }, [questions, filterCategory, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索题目..."
            className="pl-9 h-9 rounded-xl text-sm focus-visible:ring-amber-200"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-xl h-9 text-xs hover:border-amber-300 hover:text-amber-600"
          onClick={() => setAddDialogOpen(true)}
        >
          <Icon name="add" size={16} />
          添加题目
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-xl h-9 text-xs hover:border-amber-300 hover:text-amber-600"
          onClick={onOpenUpload}
        >
          <Icon name="upload_file" size={16} />
          上传文件
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setFilterCategory("all")}
          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
            filterCategory === "all"
              ? "bg-zinc-800 text-white"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
          }`}
        >
          全部 ({questions.length})
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const count = questions.filter((q) => q.category === cat).length;
          if (count === 0) return null;
          const colors = CATEGORY_COLORS[cat];
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                filterCategory === cat ? colors : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Question list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <Icon name="library_books" size={40} className="mx-auto mb-3 text-amber-300" />
          <p className="text-sm">{questions.length === 0 ? "题库为空，添加题目开始吧" : "没有匹配的题目"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => (
            <div
              key={q.id}
              className={`group relative rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 transition-all active:scale-[0.99] ${
                selectedIds?.has(q.id)
                  ? "border-amber-300 bg-amber-50/50"
                  : "border-zinc-200/60 bg-white hover:border-zinc-300"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {/* Selection checkbox (when in paper builder mode) */}
                {onToggleSelect && (
                  <button
                    type="button"
                    onClick={() => onToggleSelect(q.id)}
                    className="mt-0.5 shrink-0"
                  >
                    <Icon
                      name={selectedIds?.has(q.id) ? "check_circle" : "radio_button_unchecked"}
                      size={20}
                      fill={selectedIds?.has(q.id)}
                      className={selectedIds?.has(q.id) ? "text-amber-500" : "text-zinc-300"}
                    />
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-800 leading-relaxed">{q.content}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-zinc-400">
                    {q.category && (
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${CATEGORY_COLORS[q.category]}`}>
                        {q.category}
                      </span>
                    )}
                    {q.source === "file_upload" && (
                      <span className="flex items-center gap-0.5">
                        <Icon name="upload_file" size={12} />
                        {q.sourceFile || "文件导入"}
                      </span>
                    )}
                    {q.source === "homepage" && (
                      <span className="flex items-center gap-0.5">
                        <Icon name="home" size={12} />
                        首页同步
                      </span>
                    )}
                    {q.source === "edit_derived" && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Icon name="edit_note" size={12} />
                        已编辑
                      </span>
                    )}
                    <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {onGenerate && (() => {
                    const hasAnswer = answeredContents?.has(q.content.trim());
                    return (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onGenerate(q.content); }}
                        className={`p-1.5 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-all ${
                          hasAnswer
                            ? "text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50"
                            : "text-zinc-300 hover:text-amber-600 hover:bg-amber-50"
                        }`}
                        title={hasAnswer ? "查看回答" : "AI 生成回答"}
                      >
                        <Icon name={hasAnswer ? "visibility" : "auto_awesome"} size={16} />
                      </button>
                    );
                  })()}
                  {onDerive && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditQuestion(q); }}
                      className="p-1.5 rounded-lg text-zinc-300 hover:text-amber-600 hover:bg-amber-50 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                      title="编辑 (创建新版本)"
                    >
                      <Icon name="edit" size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(q.id)}
                    className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                    title="删除"
                  >
                    <Icon name="delete" size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddQuestionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={onAdd}
        onUpdateQuestion={onUpdate}
        settings={settings || DEFAULT_SETTINGS}
      />

      {editQuestion && onDerive && (
        <EditQuestionDialog
          open={!!editQuestion}
          onOpenChange={(open) => { if (!open) setEditQuestion(null); }}
          question={editQuestion}
          onSave={onDerive}
        />
      )}
    </div>
  );
}
